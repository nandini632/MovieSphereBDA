"""Exploratory analytics over the MovieLens movies, ratings, and tags."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import loader
from .service import movies_df


RATING_VALUES = [round(value / 2, 1) for value in range(1, 11)]
RATING_LABELS = [f"{value:.1f}" for value in RATING_VALUES]


def _decade(year: int) -> int | None:
    return (year // 10) * 10 if year else None


def _rating_distribution(ratings: pd.DataFrame) -> dict:
    counts = ratings["rating"].round(1).value_counts().to_dict()
    return {
        "labels": RATING_LABELS,
        "values": [int(counts.get(value, 0)) for value in RATING_VALUES],
    }


def _correlation(frame: pd.DataFrame, left: str, right: str, method: str) -> float | None:
    pairs = frame[[left, right]].dropna()
    if len(pairs) < 2 or pairs[left].nunique() < 2 or pairs[right].nunique() < 2:
        return None
    value = pairs[left].corr(pairs[right], method=method)
    return round(float(value), 3) if pd.notna(value) and np.isfinite(value) else None


def analytics_eda(
    genre: str = "", decade: str = "", min_rating: float = 0,
) -> dict:
    """Build a JSON-ready EDA snapshot, applying filters to real observations."""
    all_movies = movies_df().copy()
    raw_ratings = loader.ratings()
    all_genres = sorted({
        value for genres in all_movies["genres_list"] for value in genres
    })

    all_movies["decade"] = all_movies["year"].map(_decade)
    movie_mask = pd.Series(True, index=all_movies.index)
    if genre:
        movie_mask &= all_movies["genres_list"].map(lambda values: genre in values)
    if decade:
        if decade == "unknown":
            movie_mask &= all_movies["decade"].isna()
        else:
            movie_mask &= all_movies["decade"].eq(int(decade))
    if min_rating:
        movie_mask &= all_movies["avg_rating"].ge(float(min_rating))

    scoped_movies = all_movies.loc[movie_mask].copy()
    scoped_ids = set(scoped_movies["movieId"].astype(int).tolist())
    ratings = raw_ratings[raw_ratings["movieId"].isin(scoped_ids)].copy()

    total_ratings = int(len(ratings))
    total_movies = int(len(scoped_movies))
    total_users = int(ratings["userId"].nunique())
    average_rating = float(ratings["rating"].mean()) if total_ratings else 0.0

    # Expand genre membership only after applying the movie-level filters.
    rating_movies = ratings.merge(
        scoped_movies[["movieId", "title", "year", "genres_list"]],
        on="movieId", how="inner",
    )
    exploded = rating_movies.explode("genres_list").rename(
        columns={"genres_list": "genre"}
    )
    exploded = exploded[exploded["genre"].notna() & exploded["genre"].ne("")]

    genre_movie_rows = scoped_movies[["movieId", "genres_list"]].explode("genres_list")
    genre_movie_rows = genre_movie_rows[
        genre_movie_rows["genres_list"].notna() & genre_movie_rows["genres_list"].ne("")
    ]
    movies_by_genre = [
        {"genre": str(name), "count": int(count)}
        for name, count in genre_movie_rows["genres_list"].value_counts().items()
    ]
    if genre:
        # Preserve a zero-volume selected genre when its titles have no ratings.
        if not any(row["genre"] == genre for row in movies_by_genre):
            movies_by_genre.append({"genre": genre, "count": 0})

    genre_stats = (
        exploded.groupby("genre")["rating"]
        .agg(avg_rating="mean", ratings_count="count")
        .reset_index()
    )
    genre_stats = genre_stats[genre_stats["ratings_count"] >= 20]
    genre_stats = genre_stats.sort_values(
        ["avg_rating", "ratings_count"], ascending=[False, False]
    )
    avg_rating_by_genre = [
        {
            "genre": str(row.genre),
            "avgRating": round(float(row.avg_rating), 2),
            "ratingsCount": int(row.ratings_count),
        }
        for row in genre_stats.itertuples(index=False)
    ]

    title_stats = ratings.groupby("movieId")["rating"].agg(
        ratings_count="count", avg_rating="mean", rating_std="std"
    ).reset_index()
    title_stats = title_stats.merge(
        scoped_movies[["movieId", "title"]], on="movieId", how="left"
    )
    most_rated = title_stats.sort_values(
        ["ratings_count", "avg_rating"], ascending=[False, False]
    ).head(10)
    most_rated_movies = [
        {
            "id": int(row.movieId), "title": str(row.title),
            "ratingsCount": int(row.ratings_count),
            "avgRating": round(float(row.avg_rating), 2),
        }
        for row in most_rated.itertuples(index=False)
    ]
    prior_rating = float(raw_ratings["rating"].mean()) if len(raw_ratings) else 0.0
    smoothing_weight = 20
    title_stats["adjusted_rating"] = (
        (title_stats["ratings_count"] / (title_stats["ratings_count"] + smoothing_weight))
        * title_stats["avg_rating"]
        + (smoothing_weight / (title_stats["ratings_count"] + smoothing_weight))
        * prior_rating
    )
    top_rated = title_stats[title_stats["ratings_count"] >= 20].sort_values(
        ["adjusted_rating", "ratings_count"], ascending=[False, False]
    ).head(10)
    highest_rated_movies = [
        {
            "id": int(row.movieId), "title": str(row.title),
            "ratingsCount": int(row.ratings_count),
            "avgRating": round(float(row.avg_rating), 2),
            "adjustedRating": round(float(row.adjusted_rating), 3),
        }
        for row in top_rated.itertuples(index=False)
    ]
    most_controversial = title_stats[
        (title_stats["ratings_count"] >= 20) & title_stats["rating_std"].notna()
    ].sort_values(["rating_std", "ratings_count"], ascending=[False, False]).head(10)
    controversial_movies = [
        {
            "id": int(row.movieId), "title": str(row.title),
            "ratingsCount": int(row.ratings_count),
            "avgRating": round(float(row.avg_rating), 2),
            "ratingStdDev": round(float(row.rating_std), 3),
        }
        for row in most_controversial.itertuples(index=False)
    ]

    rated_catalog = scoped_movies[scoped_movies["ratings_count"] > 0].copy()
    correlations = {
        "popularityVsAverageRating": {
            "pearson": _correlation(rated_catalog, "ratings_count", "avg_rating", "pearson"),
            "spearman": _correlation(rated_catalog, "ratings_count", "avg_rating", "spearman"),
            "sampleSize": int(len(rated_catalog)),
        },
        "releaseYearVsAverageRating": {
            "pearson": _correlation(
                rated_catalog[rated_catalog["year"] > 0], "year", "avg_rating", "pearson"
            ),
            "spearman": _correlation(
                rated_catalog[rated_catalog["year"] > 0], "year", "avg_rating", "spearman"
            ),
            "sampleSize": int((rated_catalog["year"] > 0).sum()),
        },
    }
    popularity_sample = rated_catalog.sort_values("ratings_count")
    if len(popularity_sample) > 500:
        sample_indexes = np.linspace(0, len(popularity_sample) - 1, 500, dtype=int)
        popularity_sample = popularity_sample.iloc[sample_indexes]
    rating_popularity = [
        {
            "id": int(row.movieId), "title": str(row.title),
            "ratingsCount": int(row.ratings_count),
            "avgRating": float(row.avg_rating),
        }
        for row in popularity_sample.itertuples(index=False)
    ]

    decade_counts = scoped_movies[scoped_movies["decade"].notna()].groupby(
        "decade"
    ).size().sort_index()
    movies_by_decade = [
        {"decade": f"{int(value)}s", "count": int(count)}
        for value, count in decade_counts.items()
    ]
    unknown_years = int(scoped_movies["decade"].isna().sum())
    if unknown_years:
        movies_by_decade.append({"decade": "Unknown", "count": unknown_years})

    if total_ratings:
        timestamps = pd.to_datetime(ratings["timestamp"], unit="s", utc=True, errors="coerce")
        by_year = timestamps.dt.year.value_counts().sort_index()
        rating_activity = [
            {"year": str(int(year)), "count": int(count)}
            for year, count in by_year.items()
        ]
        weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        by_weekday = timestamps.dt.day_name().value_counts().reindex(weekday_order, fill_value=0)
        rating_weekday = [
            {"weekday": day, "count": int(count)} for day, count in by_weekday.items()
        ]
        user_counts = ratings.groupby("userId").size()
        user_bins = pd.cut(
            user_counts, bins=[0, 10, 25, 50, 100, np.inf],
            labels=["1–10", "11–25", "26–50", "51–100", "101+"],
        )
        user_activity = [
            {"range": label, "count": int(user_bins.value_counts().get(label, 0))}
            for label in ["1–10", "11–25", "26–50", "51–100", "101+"]
        ]
    else:
        rating_activity = []
        rating_weekday = [
            {"weekday": day, "count": 0}
            for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        ]
        user_activity = [
            {"range": label, "count": 0}
            for label in ["1–10", "11–25", "26–50", "51–100", "101+"]
        ]

    # The heatmap shows observed half-star counts, not inferred ratings.
    volume_by_genre = exploded.groupby("genre")["rating"].count().sort_values(ascending=False)
    heatmap_genres = [str(name) for name in volume_by_genre.head(12).index.tolist()]
    heatmap_subset = exploded[exploded["genre"].isin(heatmap_genres)].copy()
    heatmap_subset["rating_label"] = heatmap_subset["rating"].round(1).map(
        lambda value: f"{value:.1f}"
    )
    heatmap_counts = heatmap_subset.groupby(["genre", "rating_label"]).size()
    heatmap_values = [
        [int(heatmap_counts.get((name, label), 0)) for label in RATING_LABELS]
        for name in heatmap_genres
    ]

    tags = loader.tags()
    if not tags.empty and not scoped_ids:
        scoped_tags = tags.iloc[0:0]
    elif not tags.empty:
        scoped_tags = tags[tags["movieId"].isin(scoped_ids)]
    else:
        scoped_tags = tags
    popular_tags = [
        {"tag": str(name), "count": int(count)}
        for name, count in scoped_tags["tag"].astype(str).str.strip()
        .replace("", np.nan).dropna().value_counts().head(12).items()
    ]

    valid_movies = set(all_movies["movieId"].astype(int).tolist())
    required_columns = ["userId", "movieId", "rating", "timestamp"]
    missing_values = int(raw_ratings[required_columns].isna().sum().sum())
    duplicate_pairs = int(raw_ratings.duplicated(["userId", "movieId"]).sum())
    orphan_ratings = int((~raw_ratings["movieId"].isin(valid_movies)).sum())
    in_range = raw_ratings["rating"].between(0.5, 5.0)
    half_star_step = np.isclose(raw_ratings["rating"] * 2, (raw_ratings["rating"] * 2).round())
    invalid_ratings = int((~in_range | ~half_star_step).sum())
    rated_movies = int(raw_ratings["movieId"].nunique())
    coverage = (100 * rated_movies / len(all_movies)) if len(all_movies) else 0.0

    available_decades = sorted({
        int(value) for value in all_movies["decade"].dropna().unique()
    }, reverse=True)
    decade_options = [
        {"label": f"{value}s", "value": str(value)} for value in available_decades
    ]
    if all_movies["decade"].isna().any():
        decade_options.append({"label": "Unknown release year", "value": "unknown"})

    mode_rating = None
    if total_ratings:
        rounded_counts = ratings["rating"].round(1).value_counts()
        mode_rating = float(rounded_counts.index[0])

    if total_ratings:
        rating_stats = {
            "mean": round(average_rating, 3),
            "median": round(float(ratings["rating"].median()), 3),
            "stdDev": round(float(ratings["rating"].std()), 3),
            "q1": round(float(ratings["rating"].quantile(0.25)), 3),
            "q3": round(float(ratings["rating"].quantile(0.75)), 3),
            "p90": round(float(ratings["rating"].quantile(0.90)), 3),
            "fourPlusPct": round(float(ratings["rating"].ge(4).mean() * 100), 1),
            "mode": mode_rating,
        }
    else:
        rating_stats = {
            "mean": 0, "median": 0, "stdDev": 0, "q1": 0,
            "q3": 0, "p90": 0, "fourPlusPct": 0, "mode": None,
        }

    insights = []
    if most_rated_movies:
        item = most_rated_movies[0]
        insights.append({
            "icon": "fa-fire", "title": "Most discussed",
            "text": f"{item['title']} leads this view with {item['ratingsCount']:,} ratings.",
        })
    if avg_rating_by_genre:
        item = avg_rating_by_genre[0]
        insights.append({
            "icon": "fa-star", "title": "Highest-rated genre",
            "text": f"{item['genre']} averages {item['avgRating']:.2f} stars across {item['ratingsCount']:,} ratings.",
        })
    if mode_rating is not None:
        insights.append({
            "icon": "fa-chart-column", "title": "Most common score",
            "text": f"{mode_rating:.1f} stars is the most frequent rating in this view.",
        })
    if rating_activity:
        peak = max(rating_activity, key=lambda item: item["count"])
        insights.append({
            "icon": "fa-calendar-days", "title": "Peak rating year",
            "text": f"{peak['year']} has the most recorded activity ({peak['count']:,} ratings).",
        })
    if popular_tags:
        item = popular_tags[0]
        insights.append({
            "icon": "fa-hashtag", "title": "Popular community tag",
            "text": f"“{item['tag']}” appears {item['count']:,} times in the tagged titles in this view.",
        })
    if not insights:
        insights.append({
            "icon": "fa-filter-circle-xmark", "title": "No matching observations",
            "text": "Try widening the filters to reveal patterns in the dataset.",
        })

    return {
        "summary": {
            "ratings": total_ratings,
            "movies": total_movies,
            "users": total_users,
            "genres": len({value for values in scoped_movies["genres_list"] for value in values}),
            "averageRating": round(average_rating, 3),
        },
        "filters": {
            "genres": all_genres,
            "decades": decade_options,
        },
        "charts": {
            "ratingDistribution": _rating_distribution(ratings),
            "moviesByGenre": movies_by_genre,
            "avgRatingByGenre": avg_rating_by_genre,
            "mostRatedMovies": most_rated_movies,
            "moviesByDecade": movies_by_decade,
            "ratingActivity": rating_activity,
            "ratingWeekday": rating_weekday,
            "userActivity": user_activity,
            "ratingPopularity": rating_popularity,
        },
        "heatmap": {
            "genres": heatmap_genres,
            "ratings": RATING_LABELS,
            "values": heatmap_values,
        },
        "tables": {
            "highestRatedMovies": highest_rated_movies,
            "controversialMovies": controversial_movies,
            "popularTags": popular_tags,
        },
        "ratingStats": rating_stats,
        "correlations": correlations,
        "insights": insights,
        "quality": {
            "missingValues": missing_values,
            "duplicateUserMoviePairs": duplicate_pairs,
            "ratingsWithoutMovie": orphan_ratings,
            "invalidRatings": invalid_ratings,
            "ratedMovieCoveragePct": round(coverage, 1),
        },
        "source": {
            "dataset": "MovieLens Latest Small",
            "engine": "Pandas",
            "ratingRows": int(len(raw_ratings)),
            "ratingDateRange": (
                [
                    pd.to_datetime(raw_ratings["timestamp"].min(), unit="s", utc=True).strftime("%Y-%m-%d"),
                    pd.to_datetime(raw_ratings["timestamp"].max(), unit="s", utc=True).strftime("%Y-%m-%d"),
                ] if len(raw_ratings) else []
            ),
        },
    }
