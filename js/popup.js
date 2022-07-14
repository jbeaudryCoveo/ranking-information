'use strict';
// jshint -W110, -W003
/*global chrome, createWheel*/

let myDownloadTitle = '';
let currentState;
let spoofQueries = ['@sfisvisibleinapp==true @sfisvisibleinpkb==false @sfisvisibleinprm==false @sfisvisibleincsp==false', '@uri'];

function createReportHTML(title) {
  let html = '';
  //html += `<h1>${title}</h1>`;
  var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  var today = new Date();

  html += '<table><tr><td>Created on</td><td>' + today.toLocaleDateString("en-US", options) + '</td></tr>';
  html += `<tr><td>Coveo Organization</td><td><a href='${encodeURI(currentState.org_url)}'>${document.getElementById('orgName').innerText}</a></td></tr>`;
  html += `<tr><td>Search URL</td><td><a href='${encodeURI(currentState.document_url)}'>${currentState.document_url}</a></td></tr>`;
  html += '</table>';

  html += '<h2>Overview</h2>';
  html += document.getElementById('overview').innerHTML;
  html += '<hr><h2>Sources</h2>';
  html += document.getElementById('SRC').innerHTML;
  html += '<hr><h2>Query Pipelines</h2>';
  html += document.getElementById('QPL').innerHTML;
  html += '<hr><h2>API Keys</h2>';
  html += document.getElementById('API').innerHTML;
  html += '<hr><h2>Search</h2>';
  html += document.getElementById('SEARCH').innerHTML;

  return html;
}


function sanitize(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  if (string.replace) {
    return string.replace(reg, (match) => (map[match]));
  } else {
    return string;
  }
}


function getOrgInfo(report) {
  let url = getPlatformUrl(report, report.location + '/rest/organizations/' + report.org);
  let promise = new Promise((resolve) => {
    executeCall(url, report, "Getting Organization Info", "thereAreErrorsOrg").then(function (data) {
      if (data) {
        try {
          report.currentOrg = data.displayName;
        }
        catch {

        }
      }
      resolve(report);
    });
  });
  return promise;
}

function getSourceInfo(report) {
  let url = getPlatformUrl(report, report.location + '/rest/organizations/' + report.org + '/sources');
  let sources = 0;
  let disabled = 0;
  let promise = new Promise((resolve) => {
    executeCall(url, report, "Getting Source Info", "thereAreErrorsSources").then(function (data) {
      try {
        if (data) {
          report.sources = [];
          report.indSourcesSecured = true;
          data.map(source => {
            let sourceInfo = {};
            sourceInfo['name'] = source.name;
            sourceInfo['type'] = source.sourceType;
            sourceInfo['sourceVisibility'] = source.sourceVisibility;
            if (source.sourceVisibility != "SECURED") {
              report.indSourcesSecured = false;
            }
            sourceInfo['numberOfDocuments'] = source.information.numberOfDocuments;
            report.sources.push(sourceInfo);
          });
        }
      }
      catch {
      }

      resolve(report);
    });
  });
  return promise;
}


function executeCall(url, report, title, err, typeReq, auth, fd) {
  let typeOfReq = 'GET';
  //console.log(report);
  if (typeReq) {
    typeOfReq = typeReq;
  }
  if (report.nrofrequests) {
    report.nrofrequests += 1;
  }
  else {
    report.nrofrequests = 1;
  }
  document.getElementById('loadSubTitle').innerHTML = 'Nr of requests executed: ' + report.nrofrequests;
  return new Promise(function (resolve, reject) {
    $.ajax({
      url: url,
      type: typeOfReq,
      //data: JSON.stringify(fd),
      processData: false,
      //contentType: "application/json; charset=utf-8",
      //contentType: "application/x-www-form-urlencoded; charset='UTF-8'",
      contentType: false,
      dataType: 'json',
      beforeSend: setHeader,
      //error: errorMessage
      success: function (data) {
        resolve(data);
      },
      error: function (xhr, status, error) {
        report[err] = true;
        report.errors += "During: <b>" + title + "</b><BR>";
        //        report.errors += "Calling: "+url+"<BR>";
        report.errors += "Error: " + error + "<BR><hr>";
        resolve(undefined);
      },
    });
    function setHeader(xhr) {
      if (auth) {
        xhr.setRequestHeader('Authorization', auth);

      }
      else {
        if (report.token) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + report.token);
        }
      }
    };
  });

}

function getPlatformUrl(report, url) {
  return url;
}

function getQueryPipelinesInfo(report) {
  let url = getPlatformUrl(report, report.location + '/rest/search/admin/pipelines/?organizationId=' + report.org);
  let promise = new Promise((resolve) => {
    executeCall(url, report, "Getting Query Pipelines Info", "thereAreErrorsSearch").then(function (data) {
      if (data && data.map) {
        //Add to report
        report.indQPLConditionsAreSet = true;
        report.qpls = [];
        data.map(pipe => {
          let qpl = {};
          qpl['name'] = pipe.name;
          let condition = '';
          if (pipe.condition != null) {
            condition = pipe.condition.definition;
          }
          qpl['definition'] = condition;
          qpl['containsSearchHub'] = false;
          qpl['isDefault'] = pipe.isDefault;
          if (condition.toUpperCase().indexOf('SEARCHHUB') !== -1) {
            qpl['containsSearchHub'] = true;
          } else {
            report.indQPLConditionsAreSet = false;
          }
          report.qpls.push(qpl);
        });
      }
      resolve(report);
    });
  });
  return promise;
}


function getAPIInfo(report) {
  let url = getPlatformUrl(report, report.location + '/rest/organizations/' + report.org + '/apikeys');
  let promise = new Promise((resolve) => {
    executeCall(url, report, "Getting API Keys Info", "thereAreErrorsSearch").then(function (data) {
      if (data && data.map) {
        //Add to report
        report.indAPIKeysAreValid = true;
        report.apis = [];
        data.map(apikey => {
          let api = {};
          api['name'] = apikey.displayName;
          api['enabled'] = apikey.enabled;
          api['value'] = apikey.value;
          api['searchEnabled'] = false;
          api['allEnabled'] = false;
          api['viewAllEnabled'] = false;
          api['impersonateEnabled'] = false;
          if (apikey.privileges.length > 50) {
            //Means there is probably everything selected
            api['allEnabled'] = true;
          }
          apikey.privileges.map(priv => {
            if (priv.targetDomain == "EXECUTE_QUERY") {
              api['searchEnabled'] = true;
            }
            if (priv.targetDomain == "IMPERSONATE" && priv.owner == 'SEARCH_API') {
              api['impersonateEnabled'] = true;
            }
            if (priv.targetDomain == "VIEW_ALL_CONTENT") {
              api['viewAllEnabled'] = true;
            }
            //if (api['allEnabled'] && (api['searchEnabled'] || api['impersonateEnabled'] || api['viewAllEnabled']) ) {
            if (api['allEnabled'] && (api['searchEnabled'] || api['impersonateEnabled'])) {
              report.indAPIKeysAreValid = false;
            }
            if (api['searchEnabled'] && api['impersonateEnabled']) {
              report.indAPIKeysAreValid = false;
            }
            // if (api['searchEnabled'] && api['viewAllEnabled']) {
            //   report.indAPIKeysAreValid = false;
            // }
          });
          report.apis.push(api);
        });
      }
      resolve(report);
    });
  });
  return promise;
}


function processOrgReport(report) {
  $('#loading').show();
  $('#instructions').hide();
  $('#legend').hide();
  document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.';
  var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  var today = new Date();
  var checkHTML = new RegExp(/<[a-z][\s\S]*>/ig);
  /*let json = {
    forOrgReport: true,
    token: report.token,
    version: report.version,
    location: report.location,
    org: report.org,
    theDate: today.toLocaleDateString("en-US", options),
    sources: [],
    qpls: [],
    apis: []
  };*/
  //Get sources
  let json = currentState;
  json['forOrgReport'] = true;
  json['token'] = report.token;
  json['version'] = report.version;
  json['location'] = report.location;
  json['org'] = report.org;
  json['theDate'] = today.toLocaleDateString("en-US", options);

  document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Get Source Information.';
  try {
    getSourceInfo(json).then(function (json) {
      document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Get Org Information.';
      getOrgInfo(json).then(function (json) {
        document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Get QPL Information.';
        getQueryPipelinesInfo(json).then(function (json) {
          document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Get API Information.';
          getAPIInfo(json).then(function (json) {
            SendMessage({ type: 'saveOrg', json: json });
            document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Generating Report';
            //$('#makequery').removeClass('mod-hidden');
            $('#loading').hide();
            processState(json);
            //processReport(json);
          });
        });
      });
    });
  }
  catch {
    document.getElementById('loadTitle').innerHTML = 'Error getting the report. Reload page and try again!';
  }
}

if (chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    function (reportData/*, sender, sendResponse*/) {
      console.log(reportData);
      if (reportData.type === 'gotLocation') {
        let activeTab = '';
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          //console.log(reportData);
          //console.log(tabs[0]);
          //activeTab = tabs[0].id;
          //Check if we have a proper url for report
          $('#getOrgReport').attr("disabled", true);
          if (reportData.json.url.indexOf('cloud.coveo.com/admin') >0) {
            $('#getOrgReport').attr("disabled", false);
          }

          /*if (activeTab == reportData.tabid) {
            try {
              if (reportData.json.org == '') {
                $('#getOrgReport').attr("disabled", true);
              }
            } catch
            {

            }
          }*/
        });
      }
      else if (reportData.type === 'gotOrgReport') {

        processOrgReport(reportData.json);
      }
      else if (reportData.type === 'gotNumbersBackground') {
        if (reportData.global) {
          if (reportData.global.query.length == 0) {
            $('#makequery').removeClass('mod-hidden');
            $('#loading').hide();
            setTimeout(() => {
              $('#makequery').addClass('mod-hidden');
            }, 2999);
            return;

          }
        }
        else {
          $('#makequery').removeClass('mod-hidden');
          $('#loading').hide();
          setTimeout(() => {
            $('#makequery').addClass('mod-hidden');
          }, 2999);
          return;
        }
        SendMessage({ type: 'getNumbers', global: reportData.global });
      }

      /*else if (reportData.type === 'gotPerformanceReport') {
        processPerformanceReport(reportData.json);
      }
      else if (reportData.type === 'gotOrgReport') {

        processOrgReport(reportData.json);
      }*/
      if (reportData && reportData.length && reportData[0].value && reportData[0].max && reportData[0].title) {
        processReport(reportData);
      }
      return true;
    }
  );
}
else {
  setTimeout(function () {
    processReport([{
      title: "TestOnly",
      value: 31, max: 60,
      lines: [
        { label: "# of search executed (should be 1)", value: 0, expected: 1 },
        { label: "Search Events sent using our api?", value: false, expected: true },
        { label: "Analytics sent?", value: false, expected: true },
        { label: "Using search as you type (degrades performances)", value: false, expected: false },
        { label: "Using ML Powered Query Completions", value: false, expected: true },
      ]
    }]);
  });
}

function getReportHTML() {
  let text = createReportHTML(myDownloadTitle);
  let title = myDownloadTitle;//$('#xProjectname').val();
  let html = `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato">
  <link rel="stylesheet" href="http://coveo.github.io/vapor/dist/css/CoveoStyleGuide.css">
  <link rel="stylesheet" href="https://static.cloud.coveo.com/styleguide/v2.10.0/css/CoveoStyleGuide.css">
  <style type="text/css">
  body.coveo-styleguide {display:block; padding: 0 30px 30px;}
  header.header {min-height: 48px;}
  .header-section {font-size: 1.2em; font-weight: bold;}
  a {outline: none;}
  a img {outline: none;}
  img {border: 0;}
  a:focus {outline: none;}
  .bg-polygon {
    background-color: rgb(51, 51, 87) !important;
      background-image: none;
  }
  .admin-logo {
    width: 139px !important;
    padding-left: 15px !important;
    margin-top: 5px;
  }
  
  hr {
    clear: both;
}
h1 {
  font-weight: bold;
}

.smaller {
  font-size:xx-small;
}
h2, .h2 {
  font-size: 20px;
  font-weight: bold;
}
.req{
  font-size: 0.7em;
  padding-left: 10px;
}
  .popup-content {padding-left: 8px; padding-right: 8px; padding-top: 0px; overflow: auto;}

  .coveo-styleguide .collapsible .collapsible-header {background-position: left 20px center; display: flex; line-height: 50px;}
  .coveo-styleguide .collapsible .collapsible-header .msg {flex: 1;}
  .coveo-styleguide table:not(.datepicker-table) tr:hover td {background-color: transparent;}

  .mycode {margin-top: 10px;font-family: courier; font-variant: normal !important; font-weight: normal !important; word-wrap: break-word; white-space: pre-wrap; word-break: break-all;}
  .coveo-styleguide .collapsible .collapsible-header .details {color: #ce3f00; font-size: 8px;}
  .coveo-styleguide .collapsible .collapsible-header .result {color: #ce3f00; margin: auto;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel {position: relative; width: auto;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel svg {width: 40px; position: absolute; margin-top: -40px; margin-left: -10px;}
  .coveo-styleguide .collapsible .collapsible-header .result div.wheel svg .back-ring {stroke: #fff; fill: none;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel-title {display: none;}
  .coveo-styleguide .collapsible .collapsible-header.active {background-image: none;}
  .coveo-styleguide .collapsible .collapsible-body {padding: 0;}
  .coveo-styleguide table:not(.datepicker-table) td.line-result { text-align: left; font-weight: bold; vertical-align: top;}
  .coveo-styleguide table:not(.datepicker-table) th:last-child, .coveo-styleguide table:not(.datepicker-table) td:last-child {padding-left: 25px;}
  
.mycode {
  font-family: courier;
  font-variant: normal !important;
  font-weight: normal !important;
  font-size: 14px;
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-all;
}

.valid {
  width: 30px !important;
  background-position: center;
  background-size: 20px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiM0MUFENDk7fQo8L3N0eWxlPjxnPjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iNDM0LjgsNDkgMTc0LjIsMzA5LjcgNzYuOCwyMTIuMyAwLDI4OS4yIDE3NC4xLDQ2My4zIDE5Ni42LDQ0MC45IDE5Ni42LDQ0MC45IDUxMS43LDEyNS44IDQzNC44LDQ5ICAgICAiLz48L2c+PC9zdmc+);
}
.notvalid {
  width: 30px !important;
  background-position: center;
  background-size: 20px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDYxMiA3OTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA2MTIgNzkyIiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiNFNDQwNjE7fQo8L3N0eWxlPjxnPjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iMzgyLjIsMzk2LjQgNTYwLjgsMjE3LjggNDg0LDE0MSAzMDUuNCwzMTkuNiAxMjYuOCwxNDEgNTAsMjE3LjggMjI4LjYsMzk2LjQgNTAsNTc1IDEyNi44LDY1MS44ICAgIDMwNS40LDQ3My4yIDQ4NCw2NTEuOCA1NjAuOCw1NzUgMzgyLjIsMzk2LjQgICIvPjwvZz48L3N2Zz4=);
}
.center {
  background-position: center !important;
}
.validInd {
  background-position: left;
  background-position-x: 5px;
  padding-left: 22px !important;
  background-size: 15px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiM0MUFENDk7fQo8L3N0eWxlPjxnPjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iNDM0LjgsNDkgMTc0LjIsMzA5LjcgNzYuOCwyMTIuMyAwLDI4OS4yIDE3NC4xLDQ2My4zIDE5Ni42LDQ0MC45IDE5Ni42LDQ0MC45IDUxMS43LDEyNS44IDQzNC44LDQ5ICAgICAiLz48L2c+PC9zdmc+);
}
.notvalidInd {
  background-position: left;
  background-position-x: 5px;
  padding-left: 22px !important;
  background-size: 15px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDYxMiA3OTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA2MTIgNzkyIiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiNFNDQwNjE7fQo8L3N0eWxlPjxnPjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iMzgyLjIsMzk2LjQgNTYwLjgsMjE3LjggNDg0LDE0MSAzMDUuNCwzMTkuNiAxMjYuOCwxNDEgNTAsMjE3LjggMjI4LjYsMzk2LjQgNTAsNTc1IDEyNi44LDY1MS44ICAgIDMwNS40LDQ3My4yIDQ4NCw2NTEuOCA1NjAuOCw1NzUgMzgyLjIsMzk2LjQgICIvPjwvZz48L3N2Zz4=);
}

.notvalidNotMandatory { width:30px !important;background-position: center;background-size:22px;background-repeat:no-repeat;background-image:url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjwhRE9DVFlQRSBzdmcgIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICAnaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkJz48c3ZnIGhlaWdodD0iNTEycHgiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEycHgiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxnIGlkPSJyb2FkX194MkNfX3NpZ25fX3gyQ19fYWxlcnRfX3gyQ19fZGFuZ2VyX194MkNfIj48Zz48bGluZWFyR3JhZGllbnQgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8xXyIgeDE9IjE2IiB4Mj0iNDk2IiB5MT0iMjU2IiB5Mj0iMjU2Ij48c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNENTk2MzIiLz48c3RvcCBvZmZzZXQ9IjAuMDA2OCIgc3R5bGU9InN0b3AtY29sb3I6I0Q3OUIzMiIvPjxzdG9wIG9mZnNldD0iMC4wNDU2IiBzdHlsZT0ic3RvcC1jb2xvcjojREZCNDM0Ii8+PHN0b3Agb2Zmc2V0PSIwLjA4OTMiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNkM3MzUiLz48c3RvcCBvZmZzZXQ9IjAuMTM5NyIgc3R5bGU9InN0b3AtY29sb3I6I0VBRDUzNSIvPjxzdG9wIG9mZnNldD0iMC4yMDMyIiBzdHlsZT0ic3RvcC1jb2xvcjojRURERDM2Ii8+PHN0b3Agb2Zmc2V0PSIwLjMyMTQiIHN0eWxlPSJzdG9wLWNvbG9yOiNFRURGMzYiLz48c3RvcCBvZmZzZXQ9IjAuODA2MSIgc3R5bGU9InN0b3AtY29sb3I6I0VFREYzNiIvPjxzdG9wIG9mZnNldD0iMC44NzkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFREREMzYiLz48c3RvcCBvZmZzZXQ9IjAuOTE3IiBzdHlsZT0ic3RvcC1jb2xvcjojRUJENTM1Ii8+PHN0b3Agb2Zmc2V0PSIwLjk0NjkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNkM3MzUiLz48c3RvcCBvZmZzZXQ9IjAuOTcyNiIgc3R5bGU9InN0b3AtY29sb3I6I0RGQjQzNCIvPjxzdG9wIG9mZnNldD0iMC45OTU0IiBzdHlsZT0ic3RvcC1jb2xvcjojRDc5QzMyIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojRDU5NjMyIi8+PC9saW5lYXJHcmFkaWVudD48cGF0aCBkPSJNMTk5Ljk2OCw3Mi45MDVMMjQuODcyLDM3My45NyAgICBjLTI1LjExMSw0My4xODgsNi4wNzMsOTcuMzUsNTUuOTk3LDk3LjM1aDM1MC4yNjRjNDkuOTIzLDAsODEuMTAzLTU0LjE2MSw1NS45OTctOTcuMzVMMzEyLjA0Miw3Mi45MDUgICAgQzI4Ny4wMDIsMjkuOTM5LDIyNSwyOS45MzksMTk5Ljk2OCw3Mi45MDVMMTk5Ljk2OCw3Mi45MDV6IiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7ZmlsbDp1cmwoI1NWR0lEXzFfKTsiLz48cmFkaWFsR3JhZGllbnQgY3g9IjI1Ni4wMDc4IiBjeT0iMjI1Ljk0NDMiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoNi44MTM4IDAgMCA2LjgxMzggLTE0ODguMzgwMSAtMTI4My42MDY3KSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8yXyIgcj0iMjguNzM1NiI+PHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojM0Q0MTQ4Ii8+PC9yYWRpYWxHcmFkaWVudD48cGF0aCBkPSJNNDI4LjA2Miw0MzkuMjZIODMuOTQ0ICAgIGMtMTIuODEzLDAtMjQuMzAzLTYuNjU4LTMwLjY3LTE3Ljc4N2MtNi40NDEtMTEuMTIxLTYuMzY3LTI0LjM3MywwLjA3NC0zNS41MDNMMjI1LjM3LDkwLjE4NCAgICBjNi40MzgtMTAuOTgxLDE3Ljg1My0xNy41NzUsMzAuNTk2LTE3LjU3NWMxMi44MTMsMCwyNC4yMjksNi41OTQsMzAuNjc1LDE3LjU3NUw0NTguNjU3LDM4NS45NyAgICBjNi40NDcsMTEuMTMsNi41MTMsMjQuMzgyLDAuMDc1LDM1LjUwM0M0NTIuMzYsNDMyLjYwMiw0NDAuODcsNDM5LjI2LDQyOC4wNjIsNDM5LjI2TDQyOC4wNjIsNDM5LjI2eiBNMjU1Ljk2Niw4OC4xMzQgICAgYy03LjE3OSwwLTEzLjYxNCwzLjY1My0xNy4yMDMsOS44NzdMNjYuNzM5LDM5My44MDZjLTMuNjU4LDYuMjIzLTMuNjU4LDEzLjY5MS0wLjA2OCwxOS45MTEgICAgYzMuNjU5LDYuMjk5LDEwLjA5OSwxMC4wMjYsMTcuMjczLDEwLjAyNmgzNDQuMTE4YzcuMTcsMCwxMy42MTQtMy43MjgsMTcuMjcxLTEwLjAyNmMzLjU4OC02LjIyLDMuNTE0LTEzLjY4OC0wLjA3NS0xOS45MTEgICAgTDI3My4yMzksOTguMDExQzI2OS42NjEsOTEuNzg3LDI2My4yMTEsODguMTM0LDI1NS45NjYsODguMTM0TDI1NS45NjYsODguMTM0eiIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6dXJsKCNTVkdJRF8yXyk7Ii8+PHJhZGlhbEdyYWRpZW50IGN4PSIyNTYuMDA3OCIgY3k9IjIyOS40NTgiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoNi44MTM4IDAgMCA2LjgxMzggLTE0ODguMzgwMSAtMTI4My42MDY3KSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8zXyIgcj0iMTEuMTE2MSI+PHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojM0Q0MTQ4Ii8+PC9yYWRpYWxHcmFkaWVudD48cGF0aCBkPSJNMjM2LjM1MSwzMDYuNzA0VjE3NC41NzloMzkuMzA4djEzMi4xMjVIMjM2LjM1MSAgICBMMjM2LjM1MSwzMDYuNzA0eiBNMjM2LjM1MSwzODUuMTczdi00NC4zNTloMzkuMzA4djQ0LjM1OUgyMzYuMzUxeiIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6dXJsKCNTVkdJRF8zXyk7Ii8+PC9nPjwvZz48ZyBpZD0iTGF5ZXJfMSIvPjwvc3ZnPg==)}

.mod-black {
  fill: #282829;;
  stroke: #282829;;
}

.notsecure {
  --fill: #282829;;
  --stroke: #282829;;
  width: 30px !important;
  background-position: left;
  padding-left: 20px !important;
  background-size: 16px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJpY29uIG1vZC0xNiBtb2Qtc3Ryb2tlIG1vZC1ibGFjayIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJ1bmxvY2tTdHJva2VkMTYgaWNvbiIgdmlld0JveD0iMCAwIDE2IDE2IiBzdHJva2U9IiMyODI4MjkiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0yLjUgMTBBMS41IDEuNSAwIDAxNCA4LjVoNEExLjUgMS41IDAgMDE5LjUgMTB2M0ExLjUgMS41IDAgMDE4IDE0LjVINEExLjUgMS41IDAgMDEyLjUgMTN2LTN6Ij48L3BhdGg+PHBhdGggZD0iTTEzIDhWNS43NUEyLjc1IDIuNzUgMCAwMDEwLjI1IDN2MEEyLjc1IDIuNzUgMCAwMDcuNSA1Ljc1VjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+PC9wYXRoPjxjaXJjbGUgY3g9IjYiIGN5PSIxMSIgcj0iLjUiPjwvY2lyY2xlPjxwYXRoIGQ9Ik02IDEyLjV2LTEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PC9wYXRoPjwvc3ZnPg==);
}

.secure {
  width: 30px !important;
  --fill: #282829;;
  --stroke: #282829;;
  background-position: left;
  padding-left: 20px !important;
  background-size: 16px;
  background-repeat: no-repeat;
  background-image: url(data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiAgY2xhc3M9Imljb24gbW9kLTE2IG1vZC1zdHJva2UgbW9kLWJsYWNrIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9ImtleVN0cm9rZWQxNiBpY29uIiB2aWV3Qm94PSIwIDAgMTYgMTYiIHN0cm9rZT0iIzI4MjgyOSIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTEzLjU0IDExLjkxN2guNWEuNS41IDAgMDAtLjE1NS0uMzYybC0uMzQ1LjM2MnptMCAwaC41VjEzLjY0N2EuOTYyLjk2MiAwIDAxLS4yOTEuNjcxLjk2Mi45NjIgMCAwMS0uNjcxLjI5MWgwLS4wMDEgMC0uMDAyIDAtLjAwMiAwLS4wMDIgMC0uMDAyIDAtLjAwMiAwLS4wMDIgMC0uMDA2IDAtLjAwNCAwSDExLjM3aDAtLjAwNiAwLS4wMDIgMC0uMDAyIDAtLjAwMiAwLS4wMDIgMC0uMDAyIDAtLjAwMiAwLS4wMDEgMC0uMDAxIDAtLjAwMSAwLS4wMDEgMHYtLjVtMi4xOTItMi4xOTJsLjM0NS0uMzYyaDBsLS4wMDItLjAwMi0uMDA3LS4wMDYtLjAyNS0uMDI1LS4xLS4wOTQtLjM2NC0uMzVjLS4zMDktLjI5NS0uNzM1LS43MDUtMS4yMDgtMS4xNmEyODQuOTQyIDI4NC45NDIgMCAwMS0yLjgxNS0yLjc0Yy0uMTY2LS4xNjYtLjE3My0uMzY2LS4xNTktLjY3NGwuMDAzLS4wODJ2LS4wMDhsLjAwMS0uMDM5Yy4xMDUtMS4yOTYtLjIyNC0yLjQ4Ny0uOTQ3LTMuMzY0LS43MjgtLjg4Mi0xLjgyMS0xLjQwMi0zLjE1LTEuNDAyLTIuNTI2IDAtNC4wNzIgMi4xLTQuMDcyIDMuOTY0IDAgLjg2OC4xODIgMiAuODY4IDIuOTE1LjcwNy45NDIgMS44ODggMS41NzMgMy43MDggMS41MmE2IDYgMCAwMC4yNTQtLjAwN2guMDA1Yy4wOS0uMDA1LjE4NC0uMDE1LjI2MS0uMDIzbC4wMzgtLjAwNGMuMDkxLS4wMDkuMTY1LS4wMTUuMjMyLS4wMTYuMTMxIDAgLjE5LjAyMi4yMy4wNTJsLS4wMDEtLjAwMS4wMjguMDI0LjA4NC4wNzcuMjU5LjI0Ny4xMTYuMTEyYy4xOC4xNzMuMzkuMzc1LjU5Ny41N2EuNjg1LjY4NSAwIDAwLjUxNC4xNzRjLjA4NC0uMDA0LjE2OS0uMDIuMjUtLjA0NGExLjI2NSAxLjI2NSAwIDAwLS4wNS4yODQuNzkyLjc5MiAwIDAwLjIzOS42MzFjLjA2OS4wNjUuMjM2LjIyNS41MDUuMjY1YS45NS45NSAwIDAwLjM3My0uMDIyLjc5Ny43OTcgMCAwMC0uMDYxLjI3My42Ny42NyAwIDAwLjEyNi40MTRjLjA1LjA3Mi4xNzkuMjA5LjI5My4zMy4xMzEuMTM5LjI5Ni4zMDkuNDU2LjQ3NGwuNDMzLjQ0NC4xNC4xNDQuMDQuMDQuMDEuMDEuMDAzLjAwM2guMDAxbC4zNTYtLjM1bTAgMHYuNWEuNS41IDAgMDEtLjM1Ni0uMTVsLjM1Ni0uMzV6TTQuNjEyIDQuNjQ3YS41LjUgMCAwMS0uNTAzLjQ5OC41LjUgMCAwMS0uNTAzLS40OTguNS41IDAgMDEuNTAzLS40OTcuNS41IDAgMDEuNTAzLjQ5N3oiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PC9wYXRoPjwvc3ZnPg==);

}

.notvalidNotMandatoryInd { 
  background-position: left;
  background-position-x: 5px;
  padding-left: 22px !important;
  background-size: 15px;
  background-repeat: no-repeat;
  background-image:url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjwhRE9DVFlQRSBzdmcgIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICAnaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkJz48c3ZnIGhlaWdodD0iNTEycHgiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEycHgiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxnIGlkPSJyb2FkX194MkNfX3NpZ25fX3gyQ19fYWxlcnRfX3gyQ19fZGFuZ2VyX194MkNfIj48Zz48bGluZWFyR3JhZGllbnQgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8xXyIgeDE9IjE2IiB4Mj0iNDk2IiB5MT0iMjU2IiB5Mj0iMjU2Ij48c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNENTk2MzIiLz48c3RvcCBvZmZzZXQ9IjAuMDA2OCIgc3R5bGU9InN0b3AtY29sb3I6I0Q3OUIzMiIvPjxzdG9wIG9mZnNldD0iMC4wNDU2IiBzdHlsZT0ic3RvcC1jb2xvcjojREZCNDM0Ii8+PHN0b3Agb2Zmc2V0PSIwLjA4OTMiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNkM3MzUiLz48c3RvcCBvZmZzZXQ9IjAuMTM5NyIgc3R5bGU9InN0b3AtY29sb3I6I0VBRDUzNSIvPjxzdG9wIG9mZnNldD0iMC4yMDMyIiBzdHlsZT0ic3RvcC1jb2xvcjojRURERDM2Ii8+PHN0b3Agb2Zmc2V0PSIwLjMyMTQiIHN0eWxlPSJzdG9wLWNvbG9yOiNFRURGMzYiLz48c3RvcCBvZmZzZXQ9IjAuODA2MSIgc3R5bGU9InN0b3AtY29sb3I6I0VFREYzNiIvPjxzdG9wIG9mZnNldD0iMC44NzkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFREREMzYiLz48c3RvcCBvZmZzZXQ9IjAuOTE3IiBzdHlsZT0ic3RvcC1jb2xvcjojRUJENTM1Ii8+PHN0b3Agb2Zmc2V0PSIwLjk0NjkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNkM3MzUiLz48c3RvcCBvZmZzZXQ9IjAuOTcyNiIgc3R5bGU9InN0b3AtY29sb3I6I0RGQjQzNCIvPjxzdG9wIG9mZnNldD0iMC45OTU0IiBzdHlsZT0ic3RvcC1jb2xvcjojRDc5QzMyIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojRDU5NjMyIi8+PC9saW5lYXJHcmFkaWVudD48cGF0aCBkPSJNMTk5Ljk2OCw3Mi45MDVMMjQuODcyLDM3My45NyAgICBjLTI1LjExMSw0My4xODgsNi4wNzMsOTcuMzUsNTUuOTk3LDk3LjM1aDM1MC4yNjRjNDkuOTIzLDAsODEuMTAzLTU0LjE2MSw1NS45OTctOTcuMzVMMzEyLjA0Miw3Mi45MDUgICAgQzI4Ny4wMDIsMjkuOTM5LDIyNSwyOS45MzksMTk5Ljk2OCw3Mi45MDVMMTk5Ljk2OCw3Mi45MDV6IiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7ZmlsbDp1cmwoI1NWR0lEXzFfKTsiLz48cmFkaWFsR3JhZGllbnQgY3g9IjI1Ni4wMDc4IiBjeT0iMjI1Ljk0NDMiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoNi44MTM4IDAgMCA2LjgxMzggLTE0ODguMzgwMSAtMTI4My42MDY3KSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8yXyIgcj0iMjguNzM1NiI+PHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojM0Q0MTQ4Ii8+PC9yYWRpYWxHcmFkaWVudD48cGF0aCBkPSJNNDI4LjA2Miw0MzkuMjZIODMuOTQ0ICAgIGMtMTIuODEzLDAtMjQuMzAzLTYuNjU4LTMwLjY3LTE3Ljc4N2MtNi40NDEtMTEuMTIxLTYuMzY3LTI0LjM3MywwLjA3NC0zNS41MDNMMjI1LjM3LDkwLjE4NCAgICBjNi40MzgtMTAuOTgxLDE3Ljg1My0xNy41NzUsMzAuNTk2LTE3LjU3NWMxMi44MTMsMCwyNC4yMjksNi41OTQsMzAuNjc1LDE3LjU3NUw0NTguNjU3LDM4NS45NyAgICBjNi40NDcsMTEuMTMsNi41MTMsMjQuMzgyLDAuMDc1LDM1LjUwM0M0NTIuMzYsNDMyLjYwMiw0NDAuODcsNDM5LjI2LDQyOC4wNjIsNDM5LjI2TDQyOC4wNjIsNDM5LjI2eiBNMjU1Ljk2Niw4OC4xMzQgICAgYy03LjE3OSwwLTEzLjYxNCwzLjY1My0xNy4yMDMsOS44NzdMNjYuNzM5LDM5My44MDZjLTMuNjU4LDYuMjIzLTMuNjU4LDEzLjY5MS0wLjA2OCwxOS45MTEgICAgYzMuNjU5LDYuMjk5LDEwLjA5OSwxMC4wMjYsMTcuMjczLDEwLjAyNmgzNDQuMTE4YzcuMTcsMCwxMy42MTQtMy43MjgsMTcuMjcxLTEwLjAyNmMzLjU4OC02LjIyLDMuNTE0LTEzLjY4OC0wLjA3NS0xOS45MTEgICAgTDI3My4yMzksOTguMDExQzI2OS42NjEsOTEuNzg3LDI2My4yMTEsODguMTM0LDI1NS45NjYsODguMTM0TDI1NS45NjYsODguMTM0eiIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6dXJsKCNTVkdJRF8yXyk7Ii8+PHJhZGlhbEdyYWRpZW50IGN4PSIyNTYuMDA3OCIgY3k9IjIyOS40NTgiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoNi44MTM4IDAgMCA2LjgxMzggLTE0ODguMzgwMSAtMTI4My42MDY3KSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJTVkdJRF8zXyIgcj0iMTEuMTE2MSI+PHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojM0Q0MTQ4Ii8+PC9yYWRpYWxHcmFkaWVudD48cGF0aCBkPSJNMjM2LjM1MSwzMDYuNzA0VjE3NC41NzloMzkuMzA4djEzMi4xMjVIMjM2LjM1MSAgICBMMjM2LjM1MSwzMDYuNzA0eiBNMjM2LjM1MSwzODUuMTczdi00NC4zNTloMzkuMzA4djQ0LjM1OUgyMzYuMzUxeiIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6dXJsKCNTVkdJRF8zXyk7Ii8+PC9nPjwvZz48ZyBpZD0iTGF5ZXJfMSIvPjwvc3ZnPg==)
}

.help {  cursor:pointer;width:30px !important;background-position: center;background-size:25px;background-repeat:no-repeat;background-image:url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjwhRE9DVFlQRSBzdmcgIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICAnaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkJz48c3ZnIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDUwIDUwIiBoZWlnaHQ9IjUwcHgiIGlkPSJMYXllcl8xIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MCA1MCIgd2lkdGg9IjUwcHgiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxjaXJjbGUgY3g9IjI1IiBjeT0iMjUiIGZpbGw9Im5vbmUiIHI9IjI0IiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2Utd2lkdGg9IjIiLz48cmVjdCBmaWxsPSJub25lIiBoZWlnaHQ9IjUwIiB3aWR0aD0iNTAiLz48Zz48cGF0aCBkPSJNMjMuNTMzLDMwLjQwN3YtMS40N2MwLTEuNDM2LDAuMzIyLTIuMTg4LDEuMDc1LTMuMjI5bDIuNDA0LTMuM2MxLjI1NC0xLjcyMSwxLjY4NC0yLjU0NiwxLjY4NC0zLjc2NiAgIGMwLTIuMDQ0LTEuNDM0LTMuMzM1LTMuNDc5LTMuMzM1Yy0yLjAwOCwwLTMuMjk5LDEuMjE5LTMuNzI5LDMuNDA3Yy0wLjAzNiwwLjIxNS0wLjE3OSwwLjMyMy0wLjM5NSwwLjI4N2wtMi4yNTktMC4zOTUgICBjLTAuMjE2LTAuMDM2LTAuMzIzLTAuMTc5LTAuMjg4LTAuMzk1YzAuNTM5LTMuNDQzLDMuMDE0LTUuNzAzLDYuNzQ0LTUuNzAzYzMuODcyLDAsNi40OSwyLjU0Niw2LjQ5LDYuMDk3ICAgYzAsMS43MjItMC42MDgsMi45NzctMS44MjgsNC42NjNsLTIuNDAzLDMuM2MtMC43MTcsMC45NjgtMC45MzMsMS40Ny0wLjkzMywyLjY4OXYxLjE0N2MwLDAuMjE1LTAuMTQzLDAuMzU4LTAuMzU4LDAuMzU4aC0yLjM2NyAgIEMyMy42NzYsMzAuNzY2LDIzLjUzMywzMC42MjIsMjMuNTMzLDMwLjQwN3ogTTIzLjM1NCwzMy44NTFjMC0wLjIxNSwwLjE0My0wLjM1OCwwLjM1OS0wLjM1OGgyLjcyNiAgIGMwLjIxNSwwLDAuMzU4LDAuMTQ0LDAuMzU4LDAuMzU4djMuMDg0YzAsMC4yMTYtMC4xNDQsMC4zNTgtMC4zNTgsMC4zNThoLTIuNzI2Yy0wLjIxNywwLTAuMzU5LTAuMTQzLTAuMzU5LTAuMzU4VjMzLjg1MXoiLz48L2c+PC9zdmc+)}
.notmandatory { opacity:0.7}  
.crs th {color: #1e2541;font-weight: bold;} 
.crs {border:none;margin-top: 5px;width: auto;float:left;padding:10px;border-spacing: 0px;} 
.crs  th {	text-align: left;		padding:7px;font-family:Arial !important;	font-size:11pt !important;	background:#F0F0F0;	}	
.wrap {
  white-space: pre-wrap !important;
  text-overflow: unset;
  overflow:unset;
}
.comment {
  max-width: unset !important;
}

.crs td {
  white-space: nowrap;
  max-width: 200px;
  min-width: 30px;
  vertical-align: middle;
  font-family: Arial !important;
  font-size: 11pt !important;
  border-bottom: 1px solid #c0c0c0;
  padding: 5px;
  padding-right: 10px;
  word-wrap:break-word;
  /*word-break:break-word;*/
  text-overflow: ellipsis;
  overflow:hidden;
  /*text-overflow: ellipsis;
  overflow:hidden;*/
  
}
.numbers { text-align:right}
td.nobord {border:none !important;}
.propvalue,.propex,.sc {
  display: block;
    font-weight: normal;
    font-family: courier;
    padding-top: 5px;
    word-break: break-all;
}
.propex {
  word-break: break-word;
}

.proptitle {
  background-color: #e8e9ec5c;
    border-radius: 4px;
    padding: 2px;
    padding-left: 4px;
    padding-right: 4px;
    font-size: 0.9em;
    box-shadow: 1px 1px 1px 0px rgb(56 169 240 / 50%);
}
.propvalue{
  font-weight:bold;
  padding-top: 8px;
}
.propex {
  font-style: normal;
  font-size: 0.8em;
  opacity:0.6;
}
.notmandatory .propex {
  opacity: 1.0;
}
.url a {
  cursor: pointer;
  font-weight:normal;
}

span.spacing {
  font-size: 1.5em;
  display: block;
  padding: 5px;
  clear: both;
}
span.persistent {
  background-color: #fea1a1;
  font-family: courier;
  word-break: break-all;
  clear: both;
    display: block;
  /* width: 200px; */
}

span.type {
  font-size: 1.6em;
  display: block;
  padding: 5px;
  /* margin-top: 42px; */
  border-top: 1px solid #bcc3ca;
  clear: both;
  font-weight: bold;
}

span.time {
  font-size: 1.3em;
  display: block;
  padding: 5px;
  margin-left: 23px;
}
span.url{
  padding-bottom: 10px;
    display: block;
    margin-left: 30px;
    background-size: 15px;
    font-size: 1.1em;
    font-weight: bold;
    
}
.code {
  margin-left: 30px;
  font-weight: normal;
  padding-bottom: 10px !important;
    display: block;
    cursor: pointer;
    clear:both;
}

.popup-content {
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 0px;
  overflow: auto;
}
.copy-section {
  display: none;
}
ul {
  font-size:1.1em;
  font-weight: bold;
  margin-left: 25px;
  margin-top: 10px;
}
li {
  font-size: 0.9em;
  font-weight: normal;
  /* display: block; */
  padding-right: 15px;
  padding-bottom: 10px;

}
ul.item {
  font-size: 1em;
    font-weight: normal;
    margin-left: 0px;
    margin-top: 0px;
}
details.code:focus {
  outline: none !important;
}
summary:focus {
  outline: none;
}

ul.tabs{
  list-style-type:none;
  bottom: -1px;
  position:relative;
}
.tabs li{
  float:left;
}

  </style>
  <link rel="shortcut icon" href="https://www.coveo.com/public/img/favicon.png?v=1.0.72">
  <title>${title}</title>
  </head>
  <body class="coveo-styleguide">
  <header class="header bg-polygon">
    <div class="header-section">
      <a href="http://coveo.com" target="_blank">
        <div class="admin-logo">
          <div id="LogoV2" class="flex full-content"> <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 409.6 103.7" style="enable-background: new 0 0 409.6 103.7;" xml:space="preserve" class="pr1 flex flex-auto"> <style type="text/css"> .st0{fill: #ffffff;}.st1{fill: #00adff;}.st2{fill: #f05245;}.st3{fill: #1cebcf;}.st4{fill: #ffe300;}.st5{opacity: 0.87; fill: #ffffff; enable-background: new;}</style> <path class="st0" d="M164.7,36.2l-4.9,5.2c-3.4-3.3-7-5.2-11.9-5.2c-8.5,0-14.9,6.7-14.9,16.1s6.4,16.1,14.9,16.1c4.6,0,9-1.9,12.2-5.2l4.6,5.2c-4,4.6-9.7,7-16.4,7c-14,0-23.1-10-23.1-23.1c0-13.4,9.1-23.4,23.1-23.4C154.6,28.8,160.6,31.5,164.7,36.2L164.7,36.2z"></path> <path class="st0" d="M219.4,52.3c0,13.1-10,23.1-23.4,23.1c-13.7,0-23.7-10-23.7-23.1c0-13.4,10-23.4,23.7-23.4C209.4,28.9,219.4,38.9,219.4,52.3z M180.2,52.3c0,9.4,6.7,16.1,15.8,16.1c8.8,0,15.5-6.7,15.5-16.1s-6.7-16.1-15.5-16.1C186.9,36.2,180.2,42.9,180.2,52.3L180.2,52.3z"></path> <polygon class="st0" points="252.3,74.5 243.1,74.5 224.3,30.1 232.8,30.1 247.7,66.9 262.6,30.1 270.8,30.1 252.3,74.5 "></polygon> <path class="st0" d="M318.8,52v3h-35c0.9,9.1,7.3,13.7,14.9,13.7c5.1,0.1,10.1-1.8,14-5.2l4,5.2c-5.5,5.2-11.6,6.8-18.3,6.8c-13.4,0-22.8-9.1-22.8-23.1c0-13.7,9.4-23.4,22.2-23.4C310,28.9,318.8,38.6,318.8,52L318.8,52z M283.9,48.6h27.4c-0.9-7.6-6.1-12.8-13.4-12.8C290,35.9,285.1,41,283.9,48.6L283.9,48.6z"></path> <path class="st0" d="M376,52.3c0,13.1-10,23.1-23.4,23.1c-13.7,0-23.7-10-23.7-23.1c0-13.4,10-23.4,23.7-23.4C365.9,28.9,376,38.9,376,52.3z M336.8,52.3c0,9.4,6.7,16.1,15.8,16.1c8.8,0,15.5-6.7,15.5-16.1s-6.7-16.1-15.5-16.1C343.4,36.2,336.8,42.9,336.8,52.3z"></path> <path class="st1" d="M88.1,14.9C79.5,6.4,68.3,1.2,56.2,0c-0.9,0-1.6,0.8-1.6,1.8c0,0.4,0.1,0.7,0.4,1l18.8,18.5c0,0.3,0,0.3-0.3,0.3c-5.2-3.8-11.3-6.1-17.6-6.7c-0.6-0.1-1.1,0.3-1.2,0.9c0,0.3,0.1,0.6,0.3,0.9l12.8,12.8c0,0,0,0.3-0.3,0c-3.5-2.2-7.4-3.6-11.6-4c-0.6,0-0.9,0.6-0.6,1.2l21.6,21.6c0.6,0.6,1.5,0,1.2-0.6c-0.3-4.1-1.7-8.1-4-11.6c-0.3,0,0-0.3,0,0l12.5,12.2c0.6,0.6,1.8,0,1.8-0.9c-0.7-6.4-3-12.6-6.7-17.9c-0.3,0,0-0.3,0,0L100.6,48c0.5,0.6,1.3,0.7,1.9,0.3c0.5-0.3,0.7-0.9,0.5-1.5C101.9,34.7,96.6,23.4,88.1,14.9L88.1,14.9z"></path> <path class="st2" d="M14.9,14.9C23.6,6.5,34.8,1.2,46.8,0c0.9,0,1.6,0.6,1.7,1.5c0,0.4-0.1,0.9-0.5,1.2L29.5,21.3c-0.3,0.3,0,0.3,0,0.3c5.3-3.8,11.5-6.1,17.9-6.7c0.9,0,1.5,1.2,0.9,1.8L35.6,29.5c-0.3,0,0,0.3,0,0c3.5-2.2,7.4-3.5,11.6-4c0.6,0,1.2,0.6,0.6,1.2L26.1,48.3c-0.6,0.6-1.2,0-1.2-0.6c0.4-4.1,1.9-8.1,4.3-11.6c0,0-0.3-0.3-0.3,0L16.7,48.3c-0.9,0.6-2.1,0-1.8-0.9c0.6-6.5,2.9-12.7,6.7-17.9c0,0-0.3-0.3-0.3,0L2.7,48C1.5,49.2,0,48.3,0,46.8C1.2,34.8,6.5,23.6,14.9,14.9z"></path> <path class="st3" d="M14.9,88.8c8.5,8.6,19.8,13.9,31.9,14.9c0.8,0.1,1.5-0.4,1.6-1.2c0.1-0.5-0.1-0.9-0.4-1.3L29.5,82.4c-0.3,0,0-0.3,0,0c5.3,3.8,11.5,6.1,17.9,6.6c0.9,0,1.5-1.2,0.9-1.8L35.6,74.5c-0.3-0.3,0-0.3,0-0.3C39,76.5,43,78,47.1,78.4c0.6,0,1.2-0.9,0.6-1.2L26.1,55.6c-0.6-0.6-1.2-0.3-1.2,0.6c0.4,4.1,1.9,8.1,4.3,11.6c0,0-0.3,0.3-0.3,0L16.7,55.6c-0.9-0.6-2.1-0.3-1.8,0.9c0.6,6.4,2.9,12.5,6.7,17.6c0,0.2-0.1,0.3-0.3,0.3c0,0,0,0,0,0L2.7,55.6C2,55,0.9,55.2,0.4,55.9c-0.2,0.3-0.3,0.6-0.4,1C1.1,68.9,6.4,80.2,14.9,88.8z"></path> <path class="st4" d="M88.1,88.8c-8.5,8.7-19.8,14-31.9,14.9c-1.2,0.3-2.1-1.5-1.2-2.4l18.8-18.8c0,0,0-0.3-0.3,0c-5.2,3.8-11.3,6.1-17.6,6.7c-0.6,0.1-1.1-0.4-1.2-1c0-0.3,0.1-0.6,0.3-0.9l12.8-12.8c0-0.3,0-0.3-0.3-0.3c-3.4,2.4-7.4,3.9-11.5,4.2c-0.5-0.1-0.8-0.5-0.7-0.9c0-0.1,0-0.2,0.1-0.3l21.6-21.6c0.6-0.6,1.5-0.3,1.2,0.6c-0.3,4.1-1.7,8.1-4,11.6c-0.3,0,0,0.3,0,0l12.5-12.2c0.4-0.4,1.1-0.4,1.5,0c0.2,0.2,0.3,0.6,0.3,0.9c-0.7,6.3-3,12.4-6.7,17.6c-0.3,0.3,0,0.3,0,0.3l18.8-18.8c0.9-0.9,2.7,0,2.4,1.2C102,68.9,96.7,80.2,88.1,88.8L88.1,88.8z"></path> <path class="st5" d="M390.8,31.9V43h-1.9V31.9h-3.5v-1.8h9v1.8H390.8z"></path> <path class="st5" d="M407.7,43v-8.6l-3,6.2h-1.4l-3-6.2V43h-2V30.2h2l3.7,8l3.7-8h1.9V43H407.7z"></path> </svg> <div class="logo-text flex flex-center pl1 my3"></div></div>
        </div>
      </a>
    </div>
    <div class="flex-auto"></div>
    <div class="header-section mod-padded flex flex-center" id="myTitle">Coveo's Security Checker Report</div>
  </header>
  ${text}
  </body>
  </html>`;
  return html;
}

//Download the report
function downloadReport() {
  try {
    let title = currentState.currentOrg;
    myDownloadTitle = title;
    let html = getReportHTML();
    let filename = '';
    SendMessage({
      type: 'download',
      name: myDownloadTitle + '.html',
      text: html
    });
  }
  catch (err) {
    console.log('Oops, unable to download', err);
  }
}



let processState = (data) => {
  currentState = data;
  console.log('Got state');
  $('#loading').hide();
  if (!data) {
    console.log('No data');
    $('#getReport').attr("disabled", true);
    return;
  }
  $('#setSearchTracker input').prop('checked', data.enabledSearch);
  //Check if we need to enable the Analyze Queries (this should only be enabled if we have report.location available --> we need it for our check_token)
  if (data.location == '' || (data.query.length == 0 && data.query_suggest.length == 0)) {
    $('#getReport').attr("disabled", true);
  } else {
    $('#getReport').attr("disabled", false);

  }
  //if we have actual data
  console.log(data);
  let showReport = data.sources.length > 0 || data.query.length > 0 || data.query_suggest.length > 0;
  //console.log(data);
  changeUI(data.enabledSearch, false);

  if (showReport) {
    console.log('Show the report');
    $('#globalReport').show();
    $('#instructions').hide();
    $('#download-global').show();
    processData(data);
  }

  //console.log(data.enabledSearch);
  //console.log(data.tab);
  //if (data.tab != 'OverviewA')  
  fixTabs(data.tab);

};

async function checkToken(report, key, isNormalQuery) {
  let url = report.location + '/oauth/check_token';
  let data = await executeCall(url, report, "Getting Token Info", "thereAreErrorsSearch", "GET", key, undefined);
  /*
  "value": "xx9e09abb0-5fa2-4be8-80fc-a740cd392285",
  "organizationId": "cocospf4amx00",
  "enabled": true,
  "loggerId": "wdld4cqgksvebhmgfm3qqkcpgu",
  "createdDate": 1655725575000,
  "privileges": [
      {
          "targetDomain": "IMPERSONATE",
          "targetId": "*",
          "owner": "SEARCH_API"
      }
  ]*/
  if (data) {
    let valid = false;
    let comment = '';
    //data contains the priviliges
    if (getKey(data, 'enabled') == true) {
      valid = true;
    } else {
      comment = `This API Key is not enabled.`;
    }
    if (valid) {
      //Check if key is for the current org
      if (report.org != getKey(data, 'organizationId')) {
        valid = false;
        comment = `This API Key is not created for this Org<br>(current Org: <b>${report.org}</b> vs API key org: <b>${getKey(data, 'organizationId')}</b>)`;
      }
      //Check priviliges
      let searchEnabled = false;
      let allEnabled = false;
      let viewAllEnabled = false;
      let impersonateEnabled = false;
      if (data.privileges.length > 50) {
        //Means there is probably everything selected
        valid = false;
        allEnabled = true;
      }
      data.privileges.map(priv => {
        if (priv.targetDomain == "EXECUTE_QUERY") {
          searchEnabled = true;
        }
        if (priv.targetDomain == "IMPERSONATE" && priv.owner == 'SEARCH_API') {
          impersonateEnabled = true;
        }
        if (priv.targetDomain == "VIEW_ALL_CONTENT") {
          viewAllEnabled = true;
        }
        //if (api['allEnabled'] && (api['searchEnabled'] || api['impersonateEnabled'] || api['viewAllEnabled']) ) {
        // if (api['searchEnabled'] && api['viewAllEnabled']) {
        //   report.indAPIKeysAreValid = false;
        // }
      });
      if (allEnabled && (searchEnabled || impersonateEnabled)) {
        valid = false;
        comment = 'Search/Impersonate and Admin enabled, only use on of them';
      }
      if (searchEnabled && impersonateEnabled) {
        valid = false;
        comment = 'Search and Impersonate enabled, only use one of them';
      }
      if (viewAllEnabled) {
        if (comment != '') {
          comment += '<br>';
        }

        comment += 'View all is enabled, users can view all content with this setting!';
      }
      if (comment != '') {
        comment += '<br><a href="https://docs.coveo.com/en/1718/manage-an-organization/manage-api-keys#leading-practices" target="_blank">?</a>'
      }

      if (isNormalQuery) {
        report.txtSearchToken = JSON.stringify(data, null, 2);
        report.indSearchAPIKeysAreValid = valid;
        report.indSearchAPIKeyComment = comment;
      } else {
        report.txtSearchQSToken = JSON.stringify(data, null, 2);
        report.indSearchQSAPIKeysAreValid = valid;
        report.indSearchQSAPIKeyComment = comment;
      }
    }
  }
  return report;

}

let processData = (state) => {
  //Add warnings to headers
  let overviewValid = state.indSourcesSecured && state.indQPLConditionsAreSet && state.indAPIKeysAreValid;
  overviewValid = overviewValid && state.indSearchAPIKeysAreValid && state.indSearchQSAPIKeysAreValid;
  overviewValid = overviewValid && state.indSearchSpoofingNotPossible && state.indSearchSpoofingQSNotPossible;
  if (state.currentOrg == '') {
    $('#titleOrg').hide();
  } else {
    $('#titleOrg').show();
    document.getElementById('orgName').innerText = state.currentOrg + ' (' + state.org + ')';
  }
  if (state.currentSearch == '') {
    $('#titleSearch').hide();
  } else {
    $('#titleSearch').show();
    document.getElementById('searchName').innerText = state.currentSearch;
  }
  document.getElementById('OverviewA').className = overviewValid ? "validInd" : "notvalidInd";
  document.getElementById('SRCA').className = state.indSourcesSecured ? "validInd" : "notvalidNotMandatoryInd";
  document.getElementById('QPLA').className = state.indQPLConditionsAreSet ? "validInd" : "notvalidInd";
  document.getElementById('APIA').className = state.indAPIKeysAreValid ? "validInd" : "notvalidInd";
  document.getElementById('SEARCHA').className = (state.indSearchAPIKeysAreValid && state.indSearchQSAPIKeysAreValid && state.indSearchSpoofingNotPossible && state.indSearchSpoofingQSNotPossible) ? "validInd" : "notvalidInd";
  let overview = '';
  let comment = '';
  overview += `<table class="crs datepicker-table"><tr><th>Result</th><th>Check</th></tr>`;
  if (state.sources.length == 0) {
    overview += `<tr><td ></td><td class="comment">No Organization data available yet</td></tr>`;

  } else {
    overview += `<tr><td class=${state.indSourcesSecured ? "valid" : "notvalidNotMandatory"}></td><td class="comment">${state.indSourcesSecured ? "Sources are secure" : "Sources needs to be checked"}</td></tr>`;
    overview += `<tr><td class=${state.indQPLConditionsAreSet ? "valid" : "notvalid"}></td><td class="comment">${state.indQPLConditionsAreSet ? "Query Pipelines have conditions set on the Search Hub" : "Query Pipelines needs conditions on the Search Hub"}</td></tr>`;
    overview += `<tr><td class=${state.indAPIKeysAreValid ? "valid" : "notvalid"}></td><td class="comment">${state.indQPLConditionsAreSet ? "API Keys (platform) are properly configured" : "API Keys (platform) needs to be checked"}</td></tr>`;
  }
  //  if (state.query.length == 0 && state.query_suggest.length == 0 && state.queries_analyzed == true) {
  if (state.queries_analyzed == false) {
    overview += `<tr><td ></td><td class="comment">No search queries executed yet.<br>Enable <b>Search Tracker</b>,<br>execute queries and hit <b>Analyze Queries</b>.</td></tr>`;

  } else {
    if (state.query.length > 0) {
      overview += `<tr><td class=${state.indSearchAPIKeysAreValid ? "valid" : "notvalid"}></td><td class="comment">${state.indSearchAPIKeysAreValid ? "Search API Keys are properly configured" : "Search API Keys needs to be checked"}</td></tr>`;
      if (state.query_suggest.length == 0) {
        overview += `<tr><td class="notvalidNotMandatory"></td><td class="comment">Search Suggest call not catched, is it being used?</td></tr>`;
        overview += `<tr><td class=${(state.indSearchSpoofingNotPossible) ? "valid" : "notvalid"}></td><td class="comment">${(state.indSearchSpoofingNotPossible) ? "Search Queries cannot be Spoofed" : "Search Queries can be Spoofed"}</td></tr>`;
      }
    }
    if (state.query_suggest.length > 0) {
      if (state.query.length == 0) {
        overview += `<tr><td class="notvalidNotMandatory"></td><td class="comment">Search call not catched, is it being used?</td></tr>`;
      }
      overview += `<tr><td class=${state.indSearchQSAPIKeysAreValid ? "valid" : "notvalid"}></td><td class="comment">${state.indSearchQSAPIKeysAreValid ? "Search Suggest API Keys are properly configured" : "Search Suggest API Keys needs to be checked"}</td></tr>`;
      if (state.query.length == 0) {
        overview += `<tr><td class=${(state.indSearchSpoofingQSNotPossible) ? "valid" : "notvalid"}></td><td class="comment">${(state.indSearchSpoofingNotPossible && state.indSearchSpoofingQSNotPossible) ? "Search Queries cannot be Spoofed" : "Search Queries can be Spoofed"}</td></tr>`;
      }
    }
    if (state.query.length > 0 && state.query_suggest.length > 0) {
      overview += `<tr><td class=${(state.indSearchSpoofingNotPossible && state.indSearchSpoofingQSNotPossible) ? "valid" : "notvalid"}></td><td class="comment">${(state.indSearchSpoofingNotPossible && state.indSearchSpoofingQSNotPossible) ? "Search Queries cannot be Spoofed" : "Search Queries can be Spoofed"}</td></tr>`;
    }
  }
  overview += `</table>`;
  //console.log(overview);
  document.getElementById('overview').innerHTML = overview;

  let queries = '';
  comment = '';
  queries += `<table class="crs datepicker-table"><tr><th>Result</th><th>Name</th><th>Type</th><th>Security</th><th>No of Docs</th><th>Comment</th></tr>`;
  for (let i = 0; i < state.sources.length; ++i) {
    let sourceInfo = state.sources[i];
    let valid = true;
    let classn = 'secure';
    comment = '';
    if (sourceInfo['sourceVisibility'] != "SECURED") {
      valid = false;
      classn = 'notsecure';
      comment = 'Is this content intended to be public/shared?<br><a href="https://docs.coveo.com/en/3246/index-content/defining-source-level-permissions" target="_blank">?</a>';
    }
    queries += `<tr><td class=${valid ? "valid" : "notvalidNotMandatory"}></td><td>${sourceInfo['name']}</td><td >${sourceInfo['type']}</td><td class="${classn}">${sourceInfo['sourceVisibility']}</td><td class=numbers>${sourceInfo['numberOfDocuments']}</td><td class="comment">${comment}</td></tr>`;
  }
  queries += `</table>`;
  document.getElementById('SRC').innerHTML = queries;

  queries = '';
  queries += `<table class="crs datepicker-table"><tr><th>Result</th><th>Name</th><th>Default</th><th>SearchHub<br>Condition<br>set</th><th>Condition</th><th>Comment</th></tr>`;
  for (let i = 0; i < state.qpls.length; ++i) {
    let qpl = state.qpls[i];
    let valid = true;
    let def = qpl['isDefault'];
    valid = qpl['containsSearchHub'];
    comment = '';
    if (def) {
      comment = 'This is the default pipeline, when no pipeline is set, this one will be used.'
    }
    if (!valid) {
      if (comment != '') {
        comment += '<br>';
      }
      comment += 'No condition is set on the search hub, this could lead to query spoofing!<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
    }
    queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td>${qpl['name']}</td><td class="${def ? "validInd center" : ""}"></td><td class="${qpl['containsSearchHub'] ? "validInd center" : "notvalidInd center"}"></td><td class="wrap">${qpl['definition']}</td><td class="comment">${comment}</td></tr>`;
  }
  queries += `</table>`;
  document.getElementById('QPL').innerHTML = queries;

  queries = '';
  queries += `<table class="crs datepicker-table"><tr><th>Result</th><th>Name</th><th>Enabled</th><th>Admin</th><th>Search</th><th>Impersonate</th><th>View All</th><th>Comment</th></tr>`;
  for (let i = 0; i < state.apis.length; ++i) {
    let api = state.apis[i];
    let valid = true;
    let comment = '';
    let classn = '';

    if (api['searchEnabled'] && api['impersonateEnabled']) {
      valid = false;
      comment = 'Search and Impersonate enabled, only use one of them';
    }

    if (api['allEnabled'] && (api['searchEnabled'] || api['impersonateEnabled'])) {
      valid = false;
      comment = 'Search/Impersonate and Admin enabled, only use on of them';
    }
    if (api['viewAllEnabled']) {
      if (comment != '') {
        comment += '<br>';
      }

      comment += 'View all is enabled, users can view all content with this setting!';
    }
    if (comment != '') {
      comment += '<br><a href="https://docs.coveo.com/en/1718/manage-an-organization/manage-api-keys#leading-practices" target="_blank">?</a>'
    }
    if (api['enabled'] == false) {
      classn = 'class="notenabled"';
      comment += " (not enabled)";
    }
    queries += `<tr ${classn}><td class=${valid ? "valid" : "notvalid"}></td><td>${api['name']}<br><span class="smaller">${api['value']}</span></td><td class="${api['enabled'] ? "validInd center" : "notvalidInd center"}"></td><td class="${api['allEnabled'] ? "validInd center" : "notvalidInd center"}"></td><td class="${api['searchEnabled'] ? "validInd center" : "notvalidInd center"}"></td><td class="${api['impersonateEnabled'] ? "validInd center" : "notvalidInd center"}"></td><td class="${api['viewAllEnabled'] ? "validInd center" : "notvalidInd center"}"></td><td class="comment">${comment}</td></tr>`;
  }
  queries += `</table>`;
  document.getElementById('API').innerHTML = queries;
  if (state.queries_analyzed) {
    queries = '';
    queries += `<table class="crs datepicker-table"><tr><th>Result</th><th>Description</th><th>Comment</th></tr>`;
    //Normal Queries
    let valid = true;
    if (state.query.length > 0) {
      queries += `<tr class="subtitle"><td></td><td colspan=2>Normal Queries</td></tr>`;
      valid = state.indSearchAPINoAPIKey;
      if (valid) {
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">A Search Token is used</td><td class="comment">This best practise.</td></tr>`;
        //SearchHub in token
        valid = state.indSearchHubInTokenPresent;
        comment = '';
        if (!valid) comment = 'Secure the content by using a SearchHub in your token.<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">SearchHub is present in token</td><td class="comment">${comment}</td></tr>`;
      } else {
        //API key used
        //Lookup API key in apis or using check_token?
        comment = '<br><a href="https://docs.coveo.com/en/56/build-a-search-ui/search-token-authentication#request-a-search-token" target="_blank">?</a>';
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">An API Key is used</td><td class="comment">Better is to use a generated Search Token${comment}</td></tr>`;
        valid = state.indSearchAPIKeysAreValid;
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">API Key priviliges are properly set</td><td class="comment">${state.indSearchAPIKeyComment}</td></tr>`;
      }
      //Pipeline used
      valid = state.pipelineInQuery == '';
      let pipeline = '';
      comment = '';
      if (!valid) {
        comment = "Pipeline should be empty.<br>Set it using a condition in your QPL's.";
        comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
        pipeline = '(' + state.pipelineInQuery + ')';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Pipeline ${pipeline} is ${pipeline == '' ? 'not ' : ' '}set in query</td><td class="comment">${comment}</td></tr>`;
      //Pipeline in/out comparison
      if (state.pipelineInQuery !== '') {
        valid = state.pipelineInQuery == state.pipelineInResponse;
        if (!valid) {
          comment = "Pipeline should be equal to what is requested.";
        }
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Pipeline requested (${state.pipelineInQuery}) vs pipeline returned (${state.pipelineInResponse})</td><td class="comment">${comment}</td></tr>`;
      }
      //Empty pipeline
      valid = state.indSearchEmptyPipeValid;
      if (!valid) {
        comment = "On the pipeline there should be a condition on the SearchHub, so that no other content can be requested.";
        comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Setting Empty pipeline gives ${valid ? "" : "NOT"} the same results</td><td class="comment">${comment}</td></tr>`;
      //Query spoofing
      valid = state.indSearchSpoofingNotPossible;
      if (!valid) {
        comment = "On the pipeline there should be a condition on the SearchHub, so that no other content can be requested.";
        comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Spoofing query results is ${valid ? "NOT" : ""} possible</td><td class="comment">${comment}</td></tr>`;
    } else {
      queries += `<tr class="subtitle"><td></td><td colspan=2 class="comment">Normal Queries not catched or executed yet</td></tr>`;

    }
    //**************************************************************************************************** */
    //**************************************************************************************************** */
    //**************************************************************************************************** */
    if (state.query_suggest.length > 0) {
      queries += `<tr class="subtitle"><td></td><td colspan=2>Query Suggest Queries</td></tr>`;
      valid = state.indSearchQSAPINoAPIKey;
      if (valid) {
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">A Search Token is used</td><td class="comment">This best practise.</td></tr>`;
        //SearchHub in token
        valid = state.indSearchHubInQSTokenPresent;
        comment = '';
        if (!valid) {
          comment = "Secure the content by using a SearchHub in your token";
          comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
        }
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">SearchHub is present in token</td><td class="comment">${comment}</td></tr>`;
      } else {
        //API key used
        //Lookup API key in apis or using check_token?
        comment = '<br><a href="https://docs.coveo.com/en/56/build-a-search-ui/search-token-authentication#request-a-search-token" target="_blank">?</a>';
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">An API Key is used</td><td class="comment">Better is to use a generated Search Token${comment}</td></tr>`;
        valid = state.indSearchQSAPIKeysAreValid;
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">API Key priviliges are properly set</td><td class="comment">${state.indSearchQSAPIKeyComment}</td></tr>`;
      }
      //Pipeline used
      valid = state.pipelineInQSQuery == '';
      let pipeline = '';
      comment = '';
      if (!valid) {
        comment = "Pipeline should be empty.<br>Set it using a condition in your QPL's.";
        pipeline = '(' + state.pipelineInQSQuery + ')';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Pipeline ${pipeline} is ${pipeline == '' ? 'not ' : ' '}set in query</td><td class="comment">${comment}</td></tr>`;
      //Pipeline in/out comparison
      if (state.pipelineInQSQuery !== '') {
        valid = state.pipelineInQSQuery == state.pipelineInQSResponse;
        if (!valid) {
          comment = "Pipeline should be equal to what is requested.";
        }
        queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Pipeline requested (${state.pipelineInQuery}) vs pipeline returned (${state.pipelineInResponse})</td><td class="comment">${comment}</td></tr>`;
      }
      //Empty pipeline
      valid = state.indSearchQSEmptyPipeValid;
      if (!valid) {
        comment = "On the pipeline there should be a condition on the SearchHub, so that no other content can be requested.";
        comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Setting Empty pipeline gives ${valid ? "" : "NOT"} the same results</td><td class="comment">${comment}</td></tr>`;
      valid = state.indSearchSpoofingQSNotPossible;
      if (!valid) {
        comment = "On the pipeline there should be a condition on the SearchHub, so that no other content can be requested.";
        comment += '<br><a href="https://docs.coveo.com/en/las95231/tune-relevance/ensure-that-authentication-enforces-search-hub-values" target="_blank">?</a>';
      }
      queries += `<tr><td class=${valid ? "valid" : "notvalid"}></td><td class="comment">Spoofing query results is ${valid ? "NOT" : ""} possible</td><td class="comment">${comment}</td></tr>`;
    } else {
      queries += `<tr class="subtitle"><td></td><td colspan=2 class="comment">Query Suggest Queries not catched or executed yet</td></tr>`;

    }
    queries += `<tr class="subtitle"><td></td><td colspan=2>Detailed report</td></tr>`;
    let lines = state.report.split('<BR>');
    for (let i = 0; i < lines.length; ++i) {
      queries += `<tr><td class="nobord"></td><td  class="nobord comment wrap" colspan=2>${lines[i]}</td></tr>`;
    }
    queries += `</table>`;
    //queries += state.report;
    document.getElementById('SEARCH').innerHTML = queries;
  }
  else {
    document.getElementById('SEARCH').innerHTML = 'Recorded queries: ' + state.query.length + '<br>Recorded query suggest: ' + state.query_suggest.length + '<br>Enable the <b>Search Tracker</b>.<br>Execute a couple of queries.<br>Hit <b>Analyze Queries</b> to see the results.';

  }

}


function executeQueryUICall(url, report, title, err, auth, fd) {
  let typeOfReq = 'POST';
  if (report.nrofrequests) {
    report.nrofrequests += 1;
  }
  else {
    report.nrofrequests = 1;
  }
  let newdata = {};
  Object.keys(fd).map(attr => {
    if (newdata[attr] == undefined) {
      if (!url.includes(attr + '=')) {
        newdata[attr] = fd[attr];
      }
    }
  });
  fd = newdata;
  document.getElementById('loadSubTitle').innerHTML = 'Nr of requests executed: ' + report.nrofrequests;
  return new Promise(function (resolve, reject) {
    $.ajax({
      url: url,
      type: typeOfReq,
      data: JSON.stringify(fd),
      //processData: false,
      contentType: "application/json; charset=utf-8",
      //contentType: "application/x-www-form-urlencoded; charset='UTF-8'",
      //contentType: false,
      dataType: 'json',
      beforeSend: setHeader,
      //error: errorMessage
      success: function (data) {
        resolve(data);
      },
      error: function (xhr, status, error) {
        report[err] = true;
        report.errors += "During: <b>" + title + "</b><BR>";
        //        report.errors += "Calling: "+url+"<BR>";
        report.errors += "Error: " + error + "<BR><hr>";
        let data = {};
        resolve(data);
      },
    });
    function setHeader(xhr) {
      if (auth) {
        xhr.setRequestHeader('Authorization', auth);
      }
      else {
        if (report.token) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + report.token);
        }
      }
    };
  });

}
function executeQueryUI(url, report, title, err, body) {
  //let url = query['url'];//report.searchURL + '&maximumAge=0&numberOfResults=500&debug=1&sortCriteria=@date descending&q=' + query + '&aq=' + aq;

  let promise = new Promise((resolve) => {
    try {
      document.getElementById('loadTitle').innerHTML = 'Currently loading. Please wait.<br>Executing queries and checking usage.<br>500 Results are retrieved, sorted by date.';

      executeQueryUICall(url, report, title, err, 'POST', report.searchAuth, body).then(function (data) {
        try {
          if (data) {
            resolve(data);
          }
          else {
            resolve(undefined);
          }
        }
        catch (e) {
          resolve(undefined);
        }
      });
    }
    catch (ex) {
      resolve(undefined);
    }
  });
  return promise;
}

async function executeQuery(data, override, auth, report, title, err) {
  let newdata = {...data};

  newdata = Object.assign(newdata, override);
  let url = newdata['url'];
  //delete newdata['url'];
  let result = await executeQueryUICall(url, report, title, err, auth, newdata);/*.then(function (data) {
    return data.totalCount;
  });*/
  return { 'count': result.totalCount, 'pipeline': result.pipeline };
}

function getPipeline(json) {
  let pipeline = '';
  if (json['executionReport'] != undefined) {
    for (let i = 0; i < json['executionReport'][0].children.length; ++i) {
      let report = json['executionReport'][0].children[i];
      if (report['name'] == 'ResolvePipeline') {
        pipeline = report['result']['pipeline'];
      }
    }
  }
  return pipeline;
}

async function executeQueryQS(data, override, auth, report, title, err) {
  let newdata = {...data};
  newdata = Object.assign(newdata, override);
  let url = newdata['url'];
  //delete newdata['url'];
  let result = await executeQueryUICall(url, report, title, err, auth, newdata);/*.then(function (data) {
    return data.totalCount;
  });*/
  let pipeline = getPipeline(result);
  let count = 0;
  if (result.completions !== undefined) count = result.completions.length;
  return { 'count': count, 'pipeline': pipeline };
}

function getKey(json, key) {
  if (json[key] == undefined) return ''
  else return json[key];
}

async function processQueries(json, callback) {
  json.queries_analyzed = true;
  json.report = '';
  //Take the json.query and json.query_suggest
  json.query_results = [];
  //First normal queries
  //Check token
  let report = '';
  let pipeline = '';
  let token = json['searchAuth'];
  json.indSearchSpoofingNotPossible = true;
  json.indSearchSpoofingQSNotPossible = true;
  json.indSearchHubInTokenPresent = false;
  json.indSearchHubInQSTokenPresent = false;
  let expanded_token = json['searchToken'];

  json.txtSearchToken = '';
  json.indSearchAPINoAPIKey = false;
  if (expanded_token != '' && expanded_token != undefined) {
    try {
      json.txtSearchToken = JSON.stringify(JSON.parse(expanded_token), null, 2);
      json.indSearchAPINoAPIKey = true;//this is a good thing
      json.indSearchAPIKeysAreValid = true;
      let tokenJson = JSON.parse(expanded_token);
      if (tokenJson['searchHub'] != '' && tokenJson['searchHub'] != undefined) {
        json.indSearchHubInTokenPresent = true;
      }
    }
    catch (e) {
      //This means we have an API Key
      json = await checkToken(json, json['searchToken'], true);
      json.indSearchAPINoAPIKey = false;//Not good

    }
  }
  //Check queries

  for (let i = 0; i < json.query.length; ++i) {
    let query = json.query[i];
    pipeline = getKey(query, 'pipeline');
    //Set debug=true;
    //report += "<hr><BR>";
    //Setting the query to @uri
    query['q'] = '@uri';
    report += "Normal Query: " + getKey(query, 'q') + "<BR>";
    report += "Url: " + getKey(query, 'url') + "<BR>";
    report += "Pipeline: " + getKey(query, 'pipeline') + "<BR>";
    json.pipelineInQuery = getKey(query, 'pipeline');
    report += "Debug: " + getKey(query, 'debug') + "<BR>";
    report += "Token: " + token + "<BR>";
    if (json.txtSearchToken != '') {
      report += "Expanded Token: <BR>" + "<span class=mycode>" + json.txtSearchToken + "</span><BR>";
    }

    report += "<hr><BR>";
    let res = await executeQuery(query, {}, json.searchAuth, json, 'Executing original query', 'Failed executing original query');
    let origResults = res.count;
    json.pipelineInResponse = res.pipeline;
    json.indSearchEmptyPipeValid = true;
    report += "Original number of results: " + origResults + "<BR>";
    report += "<hr><BR>";
    report += "Setting Debug=True<BR>";
    report += "Setting Pipeline to empty<BR>";
    res = await executeQuery(query, { "debug": true, "pipeline": "" }, json.searchAuth, json, 'Executing query with empty pipeline', 'Failed executing query with empty pipeline');
    if (res.count != origResults) {
      json.indSearchSpoofingNotPossible = false;
      json.indSearchEmptyPipeValid = false;
    }
    report += "Number of results: " + res.count + ", original: " + origResults + "<BR>";
    report += "<hr><BR>";
    for (let p = 0; p < spoofQueries.length; ++p) {
      report += "Setting dq to: " + spoofQueries[p] + "<BR>";
      res = await executeQuery(query, { "dq": spoofQueries[p] }, json.searchAuth, json, 'Executing query with dq parameter', 'Failed executing query with dq parameter');
      if (res.count != origResults) {
        json.indSearchSpoofingNotPossible = false;
      }
      report += "Number of results: " + res.count + ", original: " + origResults + "<BR>";
      report += "<hr><BR>";
    }
    //We only need one QS check
    break;

  }

  //Now for the QS 
  token = json['searchAuthQS'];
  //If searchToken is not empty, this means we have a valid search token and not an api key
  expanded_token = json['searchTokenQS'];
  json.txtSearchQSToken = '';
  json.indSearchQSAPINoAPIKey = false;
  json.indSearchQSAPIKeysAreValid = false;
  if (expanded_token != '' && expanded_token != undefined) {
    try {
      json.txtSearchQSToken = JSON.stringify(JSON.parse(expanded_token), null, 2);
      json.indSearchQSAPINoAPIKey = true;//this is a good thing
      json.indSearchQSAPIKeysAreValid = true;
      let tokenJson = JSON.parse(expanded_token);
      if (tokenJson['searchHub'] != '' && tokenJson['searchHub'] != undefined) {
        json.indSearchHubInQSTokenPresent = true;
      }
    }
    catch (e) {
      //This means we have an API Key
      json = await checkToken(json, json['searchTokenQS'], false);
      json.indSearchQSAPINoAPIKey = false;//Not good

    }
  }
  //Check queries

  //Query Suggest no need to execute the queries
//  for (let i = 0; i < json.query_suggest.length; ++i) {
  for (let i = json.query_suggest.length-1;i>=0; --i) {
      let query = json.query_suggest[i];
    pipeline = getKey(query, 'pipeline');
    //Set debug=true;
    //report += "<hr><BR>";
    //Setting the query to @uri
    //query['q'] = 'a';
    report += "Query Suggest Query: " + getKey(query, 'q') + "<BR>";
    report += "Url: " + getKey(query, 'url') + "<BR>";
    report += "Pipeline: " + getKey(query, 'pipeline') + "<BR>";
    json.pipelineInQSQuery = getKey(query, 'pipeline');
    report += "Debug: " + getKey(query, 'debug') + "<BR>";
    report += "Token: " + token + "<BR>";
    if (json.txtSearchQSToken != '') {
      report += "Expanded Token: <BR>" + "<span class=mycode>" + json.txtSearchQSToken + "</span><BR>";
    }

    report += "<hr><BR>";
    let res = await executeQueryQS(query, { /*"debug": true */}, json.searchAuthQS, json, 'Executing original query', 'Failed executing original query');
    let origResults = res.count;
    json.pipelineInQSResponse = res.pipeline;
    json.indSearchQSEmptyPipeValid = true;
    json.indSearchSpoofingQSNotPossible = true;
    report += "Original number of results: " + origResults + "<BR>";
    report += "<hr><BR>";
    report += "Setting Debug=True<BR>";
    report += "Setting Pipeline to empty<BR>";
    res = await executeQueryQS(query, { "debug": true, "pipeline": "" }, json.searchAuthQS, json, 'Executing query with empty pipeline', 'Failed executing query with empty pipeline');
    if (res.count != origResults) {
      json.indSearchSpoofingQSNotPossible = false;
      json.indSearchQSEmptyPipeValid = false;
    }
    report += "Number of results: " + res.count + ", original: " + origResults + "<BR>";
    report += "<hr><BR>";
    // for (let p = 0; p < spoofQueries.length; ++p) {
    //   report += "Setting dq to: " + spoofQueries[p] + "<BR>";
    //   res = await executeQuery(query, { "debug": true, "dq": spoofQueries[p] }, json.searchAuthQS, json, 'Executing query with dq parameter', 'Failed executing query with dq parameter');
    //   if (res.count != origResults) {
    //     json.indSearchSpoofingQSNotPossible = false;
    //   }
    //   report += "Number of results: " + res.count + ", original: " + origResults + "<BR>";
    // }
    //We only need one QS check
    break;
  }
  json.report = report;
  callback(json);
}

function getReport() {
  $('#loading').show();
  $('#instructions').hide();
  currentState.currentSearch = currentState.document_url;
  let showReport = currentState.sources.length > 0 || currentState.query.length > 0 || currentState.query_suggest.length > 0;
  if (!showReport) {
    $('#makequery').removeClass('mod-hidden');
    $('#loading').hide();
    setTimeout(() => {
      $('#makequery').addClass('mod-hidden');
    }, 2999);
    return;

  }
  currentState.tab = 'SEARCHA';
  processQueries(currentState, function (report) {
    SendMessage({ type: 'saveOrg', json: report });
    processState(report);
  });

}





function caseInsensitiveSort(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

//For queries, else get to many requests
function sleeper(ms) {
  return function (x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
  };
}


var convArrToObj = function (array) {
  var thisEleObj = new Object();
  if (typeof array == "object") {
    for (var i in array) {
      var thisEle = convArrToObj(array[i]);
      thisEleObj[i] = thisEle;
    }
  } else {
    thisEleObj = array;
  }
  return thisEleObj;
}


function escapeRegExp(str) {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.replace(new RegExp(escapeRegExp(search), 'g'), replacement);
};


let getState = () => {
  console.log('sending getState');
  SendMessage('getState', processState);
};


function toggleTracker() {
  let enable = $('#setSearchTracker input').prop('checked') ? true : false;
  currentState.enabledSearch = enable;
  SendMessage({ type: 'enablesearch', enable });
}



function reset() {
  //reset all parameters
  $('#instructions').show();

  $('#setSearchTracker input').prop('checked', false);
  $('#recording').hide();
  $('#loading').hide();
  $('#globalReport').hide();

  SendMessage('reset', getState);
}

function SendMessage(typeOrMessage, callback) {
  if (typeof typeOrMessage === 'string') {
    typeOrMessage = { type: typeOrMessage };
  }

  if (callback) {
    chrome.runtime.sendMessage(typeOrMessage, null, callback);
  }
  else {
    //console.log("SEnding message");
    chrome.runtime.sendMessage(typeOrMessage);
  }
}


function changeUI(enable, message = true) {
  console.log('ChangeUI');
  if (enable) {
    $('#recording').show();
    $('#download-global').show();
    $('#instructions').hide();
    //$('#download-json').show();

    $('#loading').hide();
    if (message) {
      $('#startrecord').removeClass('mod-hidden');
      setTimeout(() => {
        $('#startrecord').addClass('mod-hidden');
      }, 2999);
    }

    document.getElementById('details').innerHTML = '';
  } else {
    $('#recording').hide();
  }

}
function toggleTracker() {
  let enable = $('#setSearchTracker input').prop('checked') ? true : false;
  changeUI(enable);

  SendMessage({ type: 'enablesearch', enable });
}

function fixTabs(current) {
  /*if (current == 'NightwatchA') {
    $('#copyNightwatch').show();
  } else {
    $('#copyNightwatch').hide();
  }*/
  var tab_lists_anchors = document.querySelector("#tabbs").getElementsByTagName("a");
  var divs = document.querySelector("#tabbs").getElementsByClassName("tab-content");
  for (var i = 0; i < tab_lists_anchors.length; i++) {
    if (tab_lists_anchors[i].classList.contains('active')) {
      divs[i].style.display = "block";
    }

  }

  for (i = 0; i < tab_lists_anchors.length; i++) {


    for (i = 0; i < divs.length; i++) {
      divs[i].style.display = "none";
    }

    for (i = 0; i < tab_lists_anchors.length; i++) {
      tab_lists_anchors[i].classList.remove("active");
    }
  }
  var clicked_tab = document.getElementById(current);

  clicked_tab.classList.add('active');
  var div_to_show = clicked_tab.getAttribute('href');

  document.querySelector(div_to_show).style.display = "block";
  SendMessage({ type: 'tabset', tab: current });


}


document.addEventListener('DOMContentLoaded', function () {
  // Handle clicks on slide-toggle buttons
  var manifestData = chrome.runtime.getManifest();
  $('#myTitle').text("Coveo Security Checker " + manifestData.version);
  $('#recording').hide();
  //$('#copyNightwatch').hide();
  $('#loading').hide();
  $('#globalReport').hide();
  $('#tabs').click((e) => { fixTabs(e.target.id); return false; });
  $('#setSearchTracker input').prop('checked', false);
  $('#setSearchTracker').on('change', toggleTracker);
  $('#setSearchTrackerButton').click((e) => {
    e.preventDefault();
    $('#setSearchTracker input').prop('checked', $('#setSearchTracker input').prop('checked') ? false : true);
    toggleTracker();
    return true;
  });
  $('#download-global').hide();
  $('#download-global').click(() => {
    downloadReport();
  });

  $('#showInstructions').click(() => {
    $('#instructions').toggle();
  });

  $('#getOrgReport').click(() => {
    //Save the contents
    //SendMessage({ type: 'getOrgReport' });
    SendMessage('getOrgBackground');
  });
  $('#getReport').click(getReport);
  $('#clear').click(() => {
    reset();

  });
  SendMessage('getLocationBackground');
  getState();
});