# Coveo Ranking Information

The ranking information extension allows to see the ranking information for each result.

## Usage

Click on the extension so that it turns red to enable the ranking information.

The extension will try to add `debug=true` to the queries so that the Ranking Information is retrieved.
When an AJAX call is being made, it will also add `context['fromCRI']=true;` to the query.

In your Query Pipeline you then can set a condition to only enable `debug=true` when the Condition `Context with key fromCRI` is `populated`.

**Do _NOT_ set `debug=true` for all of your queries!!!**

## Dependencies

Google Chrome or Chromium

## Versions

1.0 Aug 2022 Initial release
