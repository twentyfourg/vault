# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.3] - 2021-05-27
### Changed
- Updated README and release pipeline for GitHub.

## [1.1.2] - 2021-05-27
### Changed
- Updated the logic gate to determine if the code is running in a container or Lambda. It now uses `AWS_LAMBDA_FUNCTION_NAME` instead of `AWS_EXECUTION_ENV` since `AWS_LAMBDA_FUNCTION_NAME` isn't always set which caused issues when using this package in a Lambda layer.
- Updated pipeline only publish package. It no longers updates the patch number.