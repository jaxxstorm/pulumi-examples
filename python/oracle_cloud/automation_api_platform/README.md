# Static Site Automation API Example

This example is based from [Komal Ali's Self Service Platyform](https://github.com/komalali/self-service-platyform)

## Prerequisites

Ensure you've authenticated against AWS and have valid credentials.

```
aws sts get-caller-identity
```

## Usage

Create a venv:

```
python 3 -m venv venv
venv/bin/python3 -m pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

Run the app:

```
FLASK_RUN_PORT=1337 FLASK_ENV=development FLASK_APP=app PULUMI_ORG=jaxxstorm venv/bin/flask run
```

