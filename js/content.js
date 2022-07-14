'use strict';
// jshint -W003
/*global chrome*/

let enabled = false;
let firstTotal = 0;


let TermColor = 'rgb(54, 162, 235)';
let ARTColor = 'rgb(75, 192, 192)';
let DNEColor = 'rgb(255, 205, 86)';
let QREColor = 'rgb(255, 159, 64)';
let DocumentColor = 'rgb(153, 102, 255)';
let DifferenceColor = 'rgb(255, 99, 132)';
let specificColors = ['rgb(251,156,18)', 'rgb(106,251,18)', 'rgb(18,219,251)', 'rgb(184,18,251)', 'rgb(247,18,251)']

function addAjaxHookSrc() {
  var s = document.createElement('script');
  s.src = "https://unpkg.com/ajax-hook@2.1.3/dist/ajaxhook.min.js";
  (document.head || document.documentElement).appendChild(s);
}

addAjaxHookSrc();

function addAjaxTracker() {
  let tracker_script = `
function hijack(url, { method }) {
    return new Promise((resolve, reject) => {
      //  Replace this code later 
      resolve();
    })
  }
  if (ah) {
  ah.proxy({
/*    onRequest: (config, handler) =>
      hijack(config.url, config)
        .then(({ response }) => {
          return handler.resolve({
            config,
            status: 200,
            headers: [],
            response,
          })
        })
        .catch(() => handler.next(config)),*/
    onResponse: (response, handler) => {
      //console.log("CRI: Ajax response");
      if (contentCRIEnabled) {
        console.log("CRI: Ajax response VALID");
        //console.log(response);
        try {
        let jsondata = JSON.parse(response.response);
        if ('totalCount' in jsondata ) {
          console.log("From Coveo Ranking Info");
          //console.log(json);
          //SendMessage then process it if needed
          window.postMessage({content:jsondata});
        }
        //console.log(jsondata);
        } 
        catch{

        }
        handler.resolve(response)
      } else {
        handler.resolve(response)
      }
    },
  })
}`;
  return tracker_script;
}

function addConsoleTracker() {
  let tracker_script = `
  var contentCRIEnabled=false;

  

const constantMock = window.fetch;
window.fetch = function () {
  return new Promise((resolve, reject) => {
    constantMock.apply(this, arguments)
      .then((response) => {
        if (contentCRIEnabled==false) {resolve(response);return}
        if (response) {
          //resolve(response);
          try {
           response.clone().json() //the response body is a readablestream, which can only be read once. That's why we make a clone here and work with the clone
             .then((json) => {
               //console.log(window['enabled']); 
              if ('totalCount' in json ) {
                console.log("From Coveo Ranking Info");
                //console.log(json);
                //SendMessage then process it if needed
                window.postMessage({content:json});
              }
              resolve(response);
            })
            .catch((error) => {
              //console.log("From Coveo Ranking Info");
              //console.log(error);
              reject(response);
             })
            }
            catch(error) {
              //console.log(error);
              reject(response);
            }
        }
        else {
          //console.log(arguments);
          //console.log("From Coveo Ranking Info");
          //console.log('Undefined Response!');
          reject(response);
        }
      })
      .catch((error) => {
        //console.log("From Coveo Ranking Info2");
        //console.log(error);
        reject();
      })
  })
}


`
    ;
  return tracker_script;
}


window.removeEventListener('message', reactOnMessage);

//setTimeout(function () {
var script = document.createElement('script');
script.textContent = addConsoleTracker();
(document.head || document.documentElement).appendChild(script);

//}, 500);
setTimeout(function () {
  var script = document.createElement('script');
  script.textContent = addAjaxTracker();
  (document.head || document.documentElement).appendChild(script);

}, 500);


window.addEventListener("message", reactOnMessage, false);



const getAllChildren = (htmlElement) => {
  if (htmlElement.children.length === 0) return [htmlElement];

  let allChildElements = [];

  for (let i = 0; i < htmlElement.children.length; i++) {
    let children = getAllChildren(htmlElement.children[i]);
    if (children) allChildElements.push(...children);
  }
  allChildElements.push(htmlElement);

  return allChildElements;
};

function clean(text) {
  text = text.replace(/<\/?[^>]+(>|$)/g, "").trim();
  return text;
}


function findElementWithTitle(title) {
  let element;
  const processNode = (el) => {
    if (el.innerHTML) {
      let text = clean(el.innerHTML);
      if (text == title) {
        element = el;
        return;
      }
    }
    if (el.shadowRoot) {
      let elements = Array.from(el.shadowRoot.children);
      elements.map(element => {
        let theelement = processNode(element);
        if (theelement) {
          element = theelement;
          return;
        }
      });
    }
    let mainElements = Array.from(el.children);
    mainElements.map(element => {
      let theelement = processNode(element);
      if (theelement) {
        element = theelement;
        return;
      }
    });

  };


  processNode(document);

  return element;

}

function findElement(uri) {
  //Traverse through all elements, URI might be referenced inside shadowroot element :(
  let element = $('a[href*="' + uri + '"]').first();
  if (element.length > 0) {
    element = element[0];
  }
  if (element.length == 0) {
    //Probably in Shadowroot
    element = undefined;

    const processNode = (el) => {
      if (el.href) {
        if (el.href == uri) {
          element = el;
          return;
        }
      }
      if (el.shadowRoot) {
        let elements = Array.from(el.shadowRoot.children);
        elements.map(element => {
          let theelement = processNode(element);
          if (theelement) {
            element = theelement;
            return;
          }
        });
      }
      let mainElements = Array.from(el.children);
      mainElements.map(element => {
        let theelement = processNode(element);
        if (theelement) {
          element = theelement;
          return;
        }
      });

    };


    processNode(document);
  }
  return element;
}

function addChartDiv(result, index) {
  // let div = `<div class="calloutCRI top-left" onclick="window.postMessage({ type: 'OpenChart', el: ${element}, params: 'myChartCRI${index}' }, '*');">Click to see Ranking Information
  // <canvas class="ChartCRI" id="myChartCRI${index}" width="400" height="300"></canvas>
  // </div>`;
  let div = `<div class="calloutCRI show ChartCRI top-left">Ranking Information
  <canvas class="ChartCRI show" id="myChartCRI${index}" width="300" height="300">MY CANVAS</canvas>
  <div style='text-align:left;width:100%;font-size:8pt;'>
  <table stye='border-spacing: 5px;'>
  <tr><td style='font-size:8pt;background-color: ${ARTColor};min-width:15px'></td><td style='padding-left:5px'>Boosted by ART</td>
  <td style='font-size:8pt;background-color: ${DocumentColor};min-width:15px'></td><td style='padding-left:5px'>Document Weights</td>
  </tr>
  <tr><td style='font-size:8pt;background-color: ${DNEColor};min-width:15px'></td><td style='padding-left:5px'>Boosted by DNE</td>
  <td style='font-size:8pt;background-color: ${TermColor};min-width:15px'></td><td style='padding-left:5px'>Term Weights</td>
  </tr>
  <tr><td style='font-size:8pt;background-color: ${DifferenceColor};min-width:15px'></td><td style='padding-left:5px'>Difference with number 1</td>
  <td style='font-size:8pt;background-color: ${QREColor};min-width:15px'></td><td style='padding-left:5px'>QRE Expressions</td>
  </tr>
  </table>
  </div>
  </div>`;
  return div;
}


function addChartEmptyDiv() {
  // let div = `<div class="calloutCRI top-left" onclick="window.postMessage({ type: 'OpenChart', el: ${element}, params: 'myChartCRI${index}' }, '*');">Click to see Ranking Information
  // <canvas class="ChartCRI" id="myChartCRI${index}" width="400" height="300"></canvas>
  // </div>`;
  let div = `<div class="calloutCRI show ChartCRI top-left">No Ranking Information available
  </div>`;
  return div;
}

function processTheResults(info) {
  firstTotal = 0;
  info.results.map((result, index) => {
    //Get the clickUri
    let uri = result.clickUri;
    //Find  it in the UI
    let element = findElement(uri);
    //let element = $('a[href*="' + uri + '"]').first();
    if (!element) {// && element.length == 0) {
      //Not found try to find it with the title
      element = findElementWithTitle(result.Title);
    }
    if (element) {
      try {
        //First check if there is already an element
        $(element.parentElement.parentElement).children('.calloutCRI').remove();
        if (result.rankingInfo == null) {
          $(addChartEmptyDiv()).insertBefore(element.parentElement);
        } else {

          let thediv = $(addChartDiv(result, index)).insertBefore(element.parentElement);
          drawChart(thediv[0].firstElementChild, result, info.rankingExpressions);
        }
      }
      catch {

      }
    }
  });
  //drawChart();
}

function reactOnMessage(event) {
  //console.log('from me');
  //console.log(JSON.stringify(event.data.content));
  if (event.data.type != undefined) {
    if (event.data.type == 'OpenChart') {
      drawChart(event.data.el, event.data.params);
    }
  }
  if (event.data.content != undefined && enabled == true) {
    //We have results, process them
    console.log("Coveo Ranking Information, received results, processing...");
    setTimeout(function () {
      processTheResults(event.data.content);
    }, 500);
  }
}



function addMessageHTML() {
  let html = `
  <style>
  
div.calloutCRI {
	/*height: 60px;*/
	/*width: 200px;*/
	float: left;
}

div.calloutCRI {
	/*background-color: #fff;
	background-image: -moz-linear-gradient(top, #444, #444);*/
	position: relative;
  text-align: center;
  cursor: pointer;
  /*top: -20px;*/
	color: #000;
	padding: 10px;
	border-radius: 3px;
	/*box-shadow: 0px 0px 20px #999;*/
	margin: 25px;
	min-height: 30px;
	/*border: 1px solid #333;*/
	/*text-shadow: 0 0 1px #000;*/
	
	/*box-shadow: 0 1px 0 rgba(255, 255, 255, 0.2) inset;*/
}

.calloutCRI::before {
	content: "";
	width: 0px;
	height: 0px;
	border: 0.8em solid transparent;
	position: absolute;
}


.calloutCRI.top-left::before {
	/*left: 7px;
	bottom: -20px;
	border-top: 10px solid #444;*/
}


  #toastedCRI,#toastedCRIError {
    visibility: hidden;
    min-width: 250px;
    /*margin-left: -125px;*/
    background-color: green;
    color: #fff;
    text-align: center;
    border-radius: 2px;
    padding: 16px;
    position: fixed;
    z-index: 1;
    left: 25%;
    top: 20%;
    height:75px;
    font-size: 17px;
}
#toastedCRIError {
  background-color: red;
}

.ChartCRI {
  visibility: hidden;
  /*min-width: 250px;*/
  /*margin-left: -125px;*/
  padding: 16px;
  /*position: fixed;*/
  z-index: 1;
  /*left: 25%;
  top: 50%;*/
  /*height:275px;*/
  font-size: 17px;
}

#toastedCRI.show,#toastedCRIError.show, .ChartCRI.show {
    visibility: visible;
    /*-webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s;
    animation: fadein 0.5s, fadeout 0.5s 2.5s;*/
}

@-webkit-keyframes fadein {
    from {bottom: 0; opacity: 0;} 
    to {bottom: 30px; opacity: 1;}
}

@keyframes fadein {
    from {bottom: 0; opacity: 0;}
    to {bottom: 30px; opacity: 1;}
}

@-webkit-keyframes fadeout {
    from {bottom: 30px; opacity: 1;} 
    to {bottom: 0; opacity: 0;}
}

@keyframes fadeout {
    from {bottom: 30px; opacity: 1;}
    to {bottom: 0; opacity: 0;}
}
  </style>
  <div id="toastedCRI">
      <div class="toast-title">Ranking Information Enabled.\nExecute a new query and to see the Ranking Information.</div>
  </div>
  <div id="toastedCRIError">
      <div class="toast-title">Your settings contain debug=true/false, the extension cannot override this.\nSet it in your QPL.</div>
  </div>
 
  <canvas id="myChart" width="300" height="300"></canvas>
 
`;
  //Check if already exists
  var x = document.getElementById("toastedCRI");
  if (x == undefined) {

    chrome.runtime.sendMessage({
      action: "loadScripts",
      url: window.location.toString()
    });
    var htmlM = document.createElement('div');
    htmlM.innerHTML = html;
    (document.body || document.documentElement).appendChild(htmlM);
  }

}

class RankingInformation {
  documentWeights;
  termsWeight;
  totalWeight;
  qreWeights;
}

class DocumentWeights {
  Adjacency;
  CollaborativeRating;
  Custom;
  Date;
  QRE;
  Quality;//: number;
  RankingFunctions;//': number;
  Source;//: number;
  Title;//: number;
  Keys;//[key: string]: number;
}

class QueryRankingExpressionWeights {
  expression;//: string;
  score;//: number;
}

//export type TermWeightReport = Record<string, StemmedTermInformation>;

class StemmedTermInformation {
  Weights;//: TermWeights | null;
  terms;//: Record<string, TermWeightsPerDocument>;
}

class TermWeights {
  Casing;//: number;
  Concept;//: number;
  Formatted;//: number;
  Frequency;//: number;
  Relation;//: number;
  Summary;//: number;
  Title;//: number;
  URI;//: number;
  Keys;//[key: string]: number;
}

class TermWeightsPerDocument {
  Correlation;//: number;
  TFIDF;//': number;
}

function parseRankingInfo(value) {
  const REGEX_EXTRACT_DOCUMENT_WEIGHTS = /Document weights:\n((?:.)*?)\n+/g;
  const REGEX_EXTRACT_TERMS_WEIGHTS = /Terms weights:\n((?:.|\n)*)\n+/g;
  const REGEX_EXTRACT_TOTAL_WEIGHTS = /Total weight: ([0-9]+)/g;

  if (!value) {
    return null;
  }

  const docWeightsRegexResult = REGEX_EXTRACT_DOCUMENT_WEIGHTS.exec(value);
  const termsWeightRegexResult = REGEX_EXTRACT_TERMS_WEIGHTS.exec(value);
  const totalWeigthRegexResult = REGEX_EXTRACT_TOTAL_WEIGHTS.exec(value);

  const qreWeights = parseQREWeights(value);
  const documentWeights = parseWeights(
    docWeightsRegexResult ? docWeightsRegexResult[1] : null
  );
  const termsWeight = parseTermsWeights(termsWeightRegexResult);
  const totalWeight = totalWeigthRegexResult
    ? Number(totalWeigthRegexResult[1])
    : null;

  return {
    documentWeights,
    termsWeight,
    totalWeight,
    qreWeights,
  }
}

function parseWeights(value) {
  const REGEX_EXTRACT_LIST_OF_WEIGHTS = /(\w+(?:\s\w+)*): ([-0-9]+)/g;
  const REGEX_EXTRACT_WEIGHT_GROUP = /^(\w+(?:\s\w+)*): ([-0-9]+)$/;

  if (!value) {
    return null;
  }

  const listOfWeight = value.match(REGEX_EXTRACT_LIST_OF_WEIGHTS);

  if (!listOfWeight) {
    return null;
  }

  let weights = {};

  for (const weight of listOfWeight) {
    const weightGroup = weight.match(REGEX_EXTRACT_WEIGHT_GROUP);

    if (weightGroup) {
      const weightAppliedOn = weightGroup[1];
      const weightValue = weightGroup[2];
      weights[weightAppliedOn] = Number(weightValue);
    }
  }
  return weights;
};

const matchExec = (value, regex) => {
  const results = []; //= [];
  let arr = [];
  while ((arr = regex.exec(value)) !== null) {
    results.push(arr);
  }
  return results;
};

const parseTermsWeights = (
  termsWeight
) => {
  const REGEX_EXTRACT_GROUP_OF_TERMS =
    /((?:[^:]+: [0-9]+, [0-9]+; )+)\n((?:\w+: [0-9]+; )+)/g;
  const REGEX_EXTRACT_SINGLE_TERM = /([^:]+): ([0-9]+), ([0-9]+); /g;

  if (!termsWeight || !termsWeight[1]) {
    return null;
  }

  const listOfTerms = matchExec(termsWeight[1], REGEX_EXTRACT_GROUP_OF_TERMS);
  if (!listOfTerms) {
    return null;
  }
  const terms = {};
  for (const term of listOfTerms) {
    const listOfWords = matchExec(term[1], REGEX_EXTRACT_SINGLE_TERM);

    const words = {};
    for (const word of listOfWords) {
      words[word[1]] = {
        Correlation: Number(word[2]),
        TFIDF: Number(word[3]),
      };
    }

    const weights = parseWeights(term[2]);
    terms[Object.keys(words).join(', ')] = {
      terms: words,
      Weights: weights,
    };
  }

  return terms;
};

const parseQREWeights = (value) => {
  const REGEX_EXTRACT_QRE_WEIGHTS =
    /Expression:\s"(.*)"\sScore:\s(?!0)([0-9]+)\n+/g;

  let qreWeightsRegexResult = REGEX_EXTRACT_QRE_WEIGHTS.exec(value);

  const qreWeights = [];
  while (qreWeightsRegexResult) {
    qreWeights.push({
      expression: qreWeightsRegexResult[1],
      score: parseInt(qreWeightsRegexResult[2], 10),
    });
    qreWeightsRegexResult = REGEX_EXTRACT_QRE_WEIGHTS.exec(value);
  }

  return qreWeights;
};

function drawChart(ctx, result, rankingExpressions) {
  //rankingExpressions contains all the ranking expressions with isConstant: true ==> is QRE else it is DNE
  if (result.rankingInfo == null) {
    ctx.parentElement.style.display = 'none';
    return;
  }

  //console.log(result.rankingInfo, result.percentScore);
  let score = result.percentScore;
  let emptyPart = 0;
  let { documentWeights,
    termsWeight,
    totalWeight,
    qreWeights } = parseRankingInfo(result.rankingInfo);
  let labels = ['Difference with Number 1', 'Document'];
  let scores = [];
  let colors = [DifferenceColor, DocumentColor];
  let data = [];
  if (firstTotal == 0) {
    firstTotal = totalWeight;
    emptyPart = 0;
  } else {
    emptyPart = firstTotal - totalWeight;
  }
  //first document weights ******************
  let docWeightTotal = 0;
  Object.keys(documentWeights).map((key) => {
    docWeightTotal += documentWeights[key];
  });
  data.push(parseInt(emptyPart * (result.percentScore / 100)));
  data.push(parseInt(docWeightTotal * (result.percentScore / 100)));
  // let datasets = [];
  // datasets.push({ label: 'Document', data: scores, borderWidth: 1, backgroundColor: colors });
  //terms document weights ******************
  // colors = [];
  // console.log(termsWeight);
  Object.keys(termsWeight).map((key) => {
    let label = key;
    scores = [];
    let total = 0;
    Object.keys(termsWeight[key]['Weights']).map((keyT) => {
      total += termsWeight[key]['Weights'][keyT];
    });
    data.push(parseInt(total * (result.percentScore / 100)));
    colors.push(TermColor);
    labels.push('Term: ' + label);
    //datasets.push({ label: 'Terms ' + label, data: scores, borderWidth: 1, backgroundColor: colors });
  });
  //qre document weights ******************
  // colors = [];
  // console.log(termsWeight);
  qreWeights.map((key) => {
    let total = key.score;
    let label = key.expression;
    if (total != 0) {
      data.push(parseInt(total * (result.percentScore / 100)));
      if (label.indexOf('permanentid') > 0 && total > 0) {
        colors.push(ARTColor);
        labels.push('ART: ' + label);

      } else {
        //Check if expression is inside the rankingExpressions and isConstant: true ==> then it is QRE else DNE
        let isDNE = false;
        rankingExpressions.map((expr) => {
          if (expr.expression == label && expr.isConstant == false) {
            isDNE = true;
          }
        });
        if (isDNE) {
          colors.push(DNEColor);
          labels.push('DNE: ' + label);

        } else {
          colors.push(QREColor);
          labels.push('QRE: ' + label);
        }
      }
    }
    //datasets.push({ label: 'Terms ' + label, data: scores, borderWidth: 1, backgroundColor: colors });
  });

  //const ctx = parent.getElementById(id);
  //ctx.className = "show";
  // const myChart = new Chart(ctx, {
  //   type: 'bar',
  //   data: {
  //     labels: labels,
  //     datasets: [
  //       {
  //         data: data,
  //         backgroundColor: colors
  //       }
  //     ]
  //   },
  //   options: {
  //     plugins: {
  //       legend: {
  //         display: false
  //       }
  //     },
  //     responsive: false,
  //     scales: {
  //       y: {
  //         beginAtZero: true,
  //         min: 0,
  //         max: firstTotal
  //       }
  //     }
  //   }
  // });
  const myChart = new Chart(ctx, {
    type: 'pie',
    plugins: [ChartDataLabels],
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors
        }
      ]
    },
    options: {
      plugins: {
        datalabels: {
          formatter: (value, context) => {

            //return context.chart.data.labels[context.dataIndex] + ' ' + Math.round(value / context.chart.getDatasetMeta(0).total * 100) + "%";
            return Math.round(value / context.chart.getDatasetMeta(0).total * 100) + "%";


          },
          color: 'black',
          anchor: 'end',
          clamp: true,
          align: 'start',
          font: {
            size: 14
          }
        },
        legend: {
          display: false,
          position: 'right'
        }
        , title: {
          display: true,
          text: 'Total Score: ' + totalWeight,
        }
      },
      responsive: false,

    }
  });
}

if (chrome && chrome.runtime && chrome.runtime.onMessage) {
  //console.log('Adding Listener');
  chrome.runtime.onMessage.addListener(function (request, sender, response) {
    console.log(request);
    if (request.type === 'enabled') {
      enabled = request.global.enabled;
      if (enabled) {
        // alert('Ranking Information Enabled.\nExecute a new query and click on one of your results to see the Ranking Information.');
        var script = document.createElement('script');
        script.textContent = 'contentCRIEnabled=true;';
        (document.head || document.documentElement).appendChild(script);

        setTimeout(function () {
          addMessageHTML();
          setTimeout(function () {
            var x = document.getElementById("toastedCRI");
            x.className = "show";
            setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);

          }, 200);
        }, 500);
        // $('#startedCRI').removeClass('mod-hidden');
        // setTimeout(() => {
        //   $('#startedCRI').addClass('mod-hidden');
        // }, 2999);
      }
    }
    if (request.type === 'errordebug') {
      //enabled = request.global.enabled;
      //if (enabled) {
      // alert('Ranking Information Enabled.\nExecute a new query and click on one of your results to see the Ranking Information.');
      addMessageHTML();
      setTimeout(function () {
        var x = document.getElementById("toastedCRIError");
        x.className = "show";
        setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);

      }, 200);
      // $('#startedCRI').removeClass('mod-hidden');
      // setTimeout(() => {
      //   $('#startedCRI').addClass('mod-hidden');
      // }, 2999);
      //}
    }
    return true;
  }
  );
}

