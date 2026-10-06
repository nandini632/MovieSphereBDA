# MovieSphere — MovieLens Big Data Analytics

MovieSphere is a BDA project for profiling, exploring, and modeling MovieLens movie-rating data. The application combines an interactive exploratory data analysis dashboard with reproducible Pandas and Spark batch jobs, including Spark MLlib ALS recommendations.

## BDA features

- Dataset profiling: movie, rating, user, genre, timestamp, and tag coverage.
- Data-quality checks: missing fields, duplicate user/movie pairs, invalid half-star scores, orphan ratings, and movie-rating coverage.
- Interactive EDA filters for genre, release decade, and minimum movie average.
- Actual half-star rating distribution; weighted rating statistics and quantiles; genre, user-activity, release-decade, weekday, and yearly activity analyses.
- Pearson and Spearman relationships between movie popularity, release year, and average score.
- Bayesian-adjusted movie ranking to reduce small-sample bias, plus rating-standard-deviation rankings to find polarizing titles.
- Genre-by-rating heatmap, observed community tags, automatically generated findings, and CSV export of the current filtered analysis.
- Distributed Spark SQL aggregations and Spark MLlib ALS recommendation artifacts.

## Dataset

The project uses MovieLens Latest Small. The included copy contains approximately 100,836 ratings, 9,742 movies, and 610 users. Required files are `data/ml-latest-small/movies.csv` and `data/ml-latest-small/ratings.csv`; `tags.csv` is optional. Set `MOVIELENS_DIR` to point to another compatible MovieLens directory.

Latest Small is useful for local development and demonstrations, but it is not a large dataset by current production standards. The Spark jobs illustrate distributed processing; use a larger MovieLens release when measuring scale.

## Project layout

```text
MovieSphereProject/
├── app.py                         Flask pages and data API
├── data_layer/
│   ├── loader.py                  MovieLens CSV loading and cache
│   ├── service.py                 Movie and recommendation queries
│   ├── eda.py                     Filtered EDA and statistical summaries
│   └── artifacts.py               Batch analytics and ALS artifacts
├── spark_jobs/
│   ├── spark_analytics.py          Spark or Pandas batch aggregations
│   ├── als_model.py                Spark ALS and Pandas SVD recommendation job
│   └── common.py                   Spark configuration and paths
├── scripts/
│   ├── run_pipeline.sh             Batch job runner
│   └── verify_als.py               Recommendation artifact checks
├── templates/                      Flask/Jinja pages
├── static/                         CSS, JavaScript, and charts
├── requirements.txt                Local dashboard and Pandas model dependencies
└── requirements-spark.txt          Optional PySpark dependency
```

## Run locally on Windows

Install Python 3.10 or newer, open PowerShell, and run:

```powershell
cd D:\ccpbl\MovieSphereProject
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/analytics` for the EDA Lab. The movie explorer, movie profiles, user insights, and ALS recommendations are also linked from the navigation.

If PowerShell blocks virtual-environment activation, run `Set-ExecutionPolicy -Scope Process Bypass` in that terminal and activate again.

## Run locally on macOS or Linux

```bash
cd /path/to/MovieSphereProject
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/analytics`.

## Run the BDA jobs

### Pandas batch analytics

This uses the project dependencies and does not require Java:

```bash
python -m spark_jobs.spark_analytics --engine pandas
```

### Spark analytics and ALS

Install Java 11 or 17, then install the optional Spark requirements:

```bash
python -m pip install -r requirements-spark.txt
python -m spark_jobs.spark_analytics --engine spark
python -m spark_jobs.als_model --engine spark
python scripts/verify_als.py
```

On Windows PowerShell, use the same commands after activating `.venv`. To serve the generated ALS recommendations, set the environment variable and restart Flask:

```powershell
$env:MOVIESPHERE_USE_ALS = "1"
python app.py
```

The Pandas SVD recommendation path is available with `python -m spark_jobs.als_model --engine pandas`; SciPy and scikit-learn are included in `requirements.txt` for that path.

## EDA API

The dashboard requests `GET /api/analytics/eda`. Optional query parameters are:

- `genre`: exact MovieLens genre, for example `Drama`
- `decade`: release decade such as `1990`, or `unknown`
- `min_rating`: minimum movie average from `0` to `5`

Other useful endpoints include `/api/analytics`, `/api/users`, `/api/movies`, `/api/movies/search?q=...`, `/api/user/<id>/insights`, and `/api/user/<id>/recommendations`.

## Method notes

- Rating averages are weighted by observed rating rows. Movie averages are not treated as equally reliable when their rating counts differ.
- Bayesian ranking uses the dataset-wide mean as its prior and a prior weight of 20 ratings. The table also displays each movie's observed mean and sample size.
- Rating spread is sample standard deviation; highly variable movies are ranked only after at least 20 ratings.
- Correlations describe association, not causation. Release years parsed from titles can be missing or imperfect.
- Timestamps are grouped in UTC. MovieLens user ratings are explicit scores, not a random sample of all viewers.
- ALS match percentages are relative within the returned recommendation list; they are not probabilities.

## Dataset citation

Retain the MovieLens dataset's included README and usage terms. Cite:

Harper, F. Maxwell, and Joseph A. Konstan. 2015. “The MovieLens Datasets: History and Context.” *ACM Transactions on Interactive Intelligent Systems*.
