# secrets-to-env

<p align="center">
  <a href="https://github.com/compasspathways/secrets-to-env-action/actions"><img alt="secrets-to-env-action status" src="https://github.com/compasspathways/secrets-to-env-action/workflows/build-test/badge.svg"></a>
</p>

This action provides the following functionality for GitHub Actions users:

- Read Github secrets and export **all** of them as environment variables
- Optionally including, excluding and manipulating variables as needed before importing

<table>
<tr>
<th>
Before
</th>
<th>
After
</th>
</tr>
<tr>
<td>
<pre>
- run: echo "Value of MY_SECRET1: $MY_SECRET1"
  env:
    MY_SECRET1: ${{ secrets.MY_SECRET1 }}
    MY_SECRET2: ${{ secrets.MY_SECRET2 }}
    MY_SECRET3: ${{ secrets.MY_SECRET3 }}
    MY_SECRET4: ${{ secrets.MY_SECRET4 }}
    MY_SECRET5: ${{ secrets.MY_SECRET5 }}
    MY_SECRET6: ${{ secrets.MY_SECRET6 }}
    ...
</pre>
</td>

<td>
<pre>
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
- run: echo "Value of MY_SECRET1: $MY_SECRET1"
</pre>
</td>

</tr>
</table>

## Usage

Add the following action to your workflow:

```yaml
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
```

After running this action, subsequent actions will be able to access the secrets as env variables.
Note the `secrets` key. It is **mandatory** so the action can read and export the secrets.

**Basic:**

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
- run: echo "Value of MY_SECRET: $MY_SECRET"
```

**Include or exclude secrets:**

Exclude defined secret `MY_SECRET` from list of secrets.

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    exclude: MY_SECRET
# MY_SECRET is not exported
```

**Only** include secret `MY_SECRET`

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    include: MY_SECRET
- run: echo "Value of MY_SECRET: $MY_SECRET"
```

NOTE: If specified secret does not exist, it is ignored.

**Add a prefix:**

Adds a prefix to all exported secrets.

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    prefix: PREFIXED_
- run: echo "Value of PREFIXED_MY_SECRET: $PREFIXED_MY_SECRET"
```

**Only export secrets that start with a given string:**

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    starts_with: TF_VAR_
- run: env | grep 'TF_VAR_'
```

**Only apply string conversions (see below) for secrets that start with a given string:**

```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    starts_with: TF_VAR_
    convert: lower
    convert_prefix: false
- run: env | grep 'TF_VAR_'
```

**Convert:**

Converts all exported secrets according to a [template](https://github.com/blakeembrey/change-case#core).
Available: `lower, upper, camel, constant, pascal, snake`.
  
```yaml
steps:
- uses: actions/checkout@v3
- uses: compasspathways/secrets-to-env-action@v1
  with:
    secrets: ${{ toJSON(secrets) }}
    convert: lower
- run: echo "Value of my_secret: $my_secret"
```

## How it works

This action uses the input in `secrets` to read all the secrets in the JSON format, and exporting all the variables one by one.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome!
