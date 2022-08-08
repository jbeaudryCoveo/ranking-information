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
let specificColors = ['rgb(251,156,18)', 'rgb(106,251,18)', 'rgb(18,219,251)', 'rgb(184,18,251)', 'rgb(247,18,251)'];
let currentColors = {};
let currentFields = [];
let minAll = 0;
let maxAll = 0;

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

function addChartDiv(result, indexr, allLabels, chartData) {
  // let div = `<div class="calloutCRI top-left" onclick="window.postMessage({ type: 'OpenChart', el: ${element}, params: 'myChartCRI${index}' }, '*');">Click to see Ranking Information
  // <canvas class="ChartCRI" id="myChartCRI${index}" width="400" height="300"></canvas>
  // </div>`;
  let table = '';
  for (let index = 0; index < Math.ceil(allLabels.length / 2); index++) {
    let element = allLabels[index];
    let label = element['label'];
    if (label.indexOf('|') > 0) {
      let labels = label.split('|');
      label = labels[0] + ' ' + labels[1];
    }
    element['color'] = '';
    let html = `<tr><td style='font-size:8pt;background-color: ${element['color']};min-width:15px'></td><td style='padding-left:5px'>${label}</td>`;
    let color = '';
    if (chartData[index].data[indexr]['v'] < 0) {
      color = 'color:red;';
    }
    html += `<td style='${color}text-align: right;'>${Math.round(chartData[index].data[indexr]['v'])}</td><td  style='${color}text-align: right;'>${chartData[index].data[indexr]['vp']}%</td>`;
    if (Math.ceil(allLabels.length / 2) + (index) < allLabels.length) {
      element = allLabels[Math.ceil(allLabels.length / 2) + (index)];
      label = element['label'];
      if (label.indexOf('|') > 0) {
        let labels = label.split('|');
        label = labels[0] + ' ' + labels[1];
      }
      element['color'] = '';
      html += `<td style='font-size:8pt;background-color: ${element['color']};min-width:15px'></td><td style='padding-left:5px'>${label}</td>`;
      color = '';
      if (chartData[Math.ceil(allLabels.length / 2) + (index)].data[indexr]['v'] < 0) {
        color = 'color:red;';
      }
      html += `<td style='${color}text-align: right;'>${Math.round(chartData[Math.ceil(allLabels.length / 2) + (index)].data[indexr]['v'])}</td><td  style='${color}text-align: right;'>${chartData[Math.ceil(allLabels.length / 2) + (index)].data[indexr]['vp']}%</td></tr>`;
    } else {
      html += `<td></td><td></td><td></td></tr>`;
    }
    table += html;
  }
  /*
    <tr><td style='font-size:8pt;background-color: ${ARTColor};min-width:15px'></td><td style='padding-left:5px'>Boosted by ART</td>
  <td style='font-size:8pt;background-color: ${DocumentColor};min-width:15px'></td><td style='padding-left:5px'>Document Weights</td>
  </tr>
  <tr><td style='font-size:8pt;background-color: ${DNEColor};min-width:15px'></td><td style='padding-left:5px'>Boosted by DNE</td>
  <td style='font-size:8pt;background-color: ${TermColor};min-width:15px'></td><td style='padding-left:5px'>Term Weights</td>
  </tr>
  <tr><td style='font-size:8pt;background-color: ${DifferenceColor};min-width:15px'></td><td style='padding-left:5px'>Difference with number 1</td>
  <td style='font-size:8pt;background-color: ${QREColor};min-width:15px'></td><td style='padding-left:5px'>QRE Expressions</td>
  </tr>
*/
  //  <canvas class="ChartCRI show" id="myChartCRI${indexr}" width="350" height="300">MY CANVAS</canvas>

  let div = `<div class="calloutCRI show ChartCRI top-left">Ranking Information
  <canvas class="ChartCRI show" id="myChartCRIB${indexr}" width="350" height="300">MY CANVAS</canvas>
  <canvas class="ChartCRI show" id="myChartCRIR${indexr}" width="350" height="300">MY CANVAS</canvas>
  <div style='text-align:left;width:100%;font-size:8pt;'>
  <table stye='border-spacing: 5px;'>${table}
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

function getMinMax(min, max, current) {
  let minval = 0;
  let maxval = 0;
  [minval, maxval] = getMinMaxNeg(min, max, current);
  return [minval, maxval];
  // let minval = 0;
  // let maxval = 0;

  // if (min == 0 || min == undefined) {
  //   minval = Math.abs(current);
  // } else {
  //   if ((min) >= Math.abs(current)) {
  //     minval = Math.abs(current);
  //   } else {
  //     minval = min;
  //   }
  // }
  // if (max == 0 || max == undefined) {
  //   maxval = Math.abs(current);
  // } else {
  //   if ((max) <= Math.abs(current)) {
  //     maxval = Math.abs(current);
  //   }
  //   else {
  //     maxval = max;
  //   }
  // }

  // return [minval, maxval]
}


function getMinMaxNeg(min, max, current) {
  let minval = 0;
  let maxval = 0;

  if (min == undefined || min == -1) {
    minval = (current);
  } else {
    if ((current) <= (min)) {
      minval = current;
    } else {
      minval = min;
    }
  }
  if (max == undefined || max == -1) {
    maxval = (current);
  } else {
    if ((current) >= (max)) {
      maxval = (current);
    }
    else {
      maxval = max;
    }
  }

  return [minval, maxval]
}

function processAllResults(results, rankingExpressions) {

  let min = {};
  let max = {};
  minAll = 0;
  maxAll = 0;
  min['docs'] = -1;
  max['docs'] = -1;
  let firstTotal = 0;
  let emptyPart = 0;
  //Calculate min/max
  //Calculate for each item the charts 
  let allBarLabels = [];
  results.map((result, index) => {
    if (result.rankingInfo == null) return;
    //if (index <= 3) {
    allBarLabels.push(index + 1);
    //}
    let score = result.percentScore;
    let { documentWeights,
      termsWeight,
      totalWeight,
      qreWeights } = parseRankingInfo(result.rankingInfo);
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
    //We need to remove the QRE weights from the docWeightTotal
    qreWeights.map((key) => {
      let total = key.score;
      docWeightTotal -= total;
    });
    docWeightTotal = docWeightTotal;//* (result.percentScore / 100);
    [min['empty'], max['empty']] = getMinMax(min['empty'], max['empty'], emptyPart);
    [min['docs'], max['docs']] = getMinMax(min['docs'], max['docs'], docWeightTotal);
    [minAll, maxAll] = getMinMax(minAll, maxAll, docWeightTotal);
    [minAll, maxAll] = getMinMax(minAll, maxAll, emptyPart);

    //terms document weights ******************
    // colors = [];
    // console.log(termsWeight);
    Object.keys(termsWeight).map((key) => {
      let label = key;
      let total = 0;
      Object.keys(termsWeight[key]['Weights']).map((keyT) => {
        total += termsWeight[key]['Weights'][keyT];
      });
      //total = (parseInt(total * (result.percentScore / 100)));
      if (min['Term' + label] == undefined) min['Term' + label] = -1;
      if (max['Term' + label] == undefined) max['Term' + label] = -1;
      [min['Term' + label], max['Term' + label]] = getMinMax(min['Term' + label], max['Term' + label], total);
      [minAll, maxAll] = getMinMax(minAll, maxAll, total);
    });
    //qre document weights ******************
    qreWeights.map((key) => {
      let total = key.score;
      let label = key.expression;
      let field = key.fields;

      if (total != 0) {
        //total = parseInt(total * (result.percentScore / 100));
        if (label.indexOf('permanentid') > 0 && total > 0) {
          if (min['ART'] == undefined) min['ART'] = -1;
          if (max['ART'] == undefined) max['ART'] = -1;
          [min['ART'], max['ART']] = getMinMax(min['ART'], max['ART'], total);
          [minAll, maxAll] = getMinMaxNeg(minAll, maxAll, total);
          //if (total < 0 && minAll > 0) minAll = -total;

        } else {
          //Check if we already have the fields, if so, add it to the same?
          let colorToChoose = DNEColor;
          let title = label;

          if (currentFields.includes(field)) {
            colorToChoose = currentColors[field];
            title = field + "|" + label;
          } else {
            currentColors[field] = specificColors[Object.keys(currentColors).length];
            currentFields.push(field);
            colorToChoose = currentColors[field];
            title = field + "|" + label;
          }
          //Check if expression is inside the rankingExpressions and isConstant: true ==> then it is QRE else DNE
          let isDNE = false;
          rankingExpressions.map((expr) => {
            if (expr.expression == label && expr.isConstant == false) {
              isDNE = true;
            }
          });
          if (isDNE) {
            //colors.push(DNEColor);
            //labels.push('DNE: ' + label);
            if (min['DNE' + field] == undefined) min['DNE' + field] = -1;
            if (max['DNE' + field] == undefined) max['DNE' + field] = -1;
            [min['DNE' + field], max['DNE' + field]] = getMinMax(min['DNE' + field], max['DNE' + field], total);
            [minAll, maxAll] = getMinMaxNeg(minAll, maxAll, total);
            //if (total < 0 && minAll > 0) minAll = -total;

          } else {
            if (min[field] == undefined) min[field] = -1;
            if (max[field] == undefined) max[field] = -1;
            [min[field], max[field]] = getMinMax(min[field], max[field], total);
            [minAll, maxAll] = getMinMaxNeg(minAll, maxAll, total);
            //if (total < 0 && minAll > 0) minAll = -total;
          }
        }
      }
    });
  });
  //fix minmax values
  Object.keys(min).map((key) => {
    if (min[key] == max[key] && min[key] != 0) {
      if (min[key] > 0) {
        min[key] = 0;
      } else {
        max[key] = 0;
      }
    }
  });
  let allValues = {};
  let allLabels = {};
  let allColors = {};
  let allIndexes = {};
  firstTotal = 0;
  //Now we have the min/max let's calculate everything for the final charts
  results.map((result, index) => {

    let score = result.percentScore;
    let { documentWeights,
      termsWeight,
      totalWeight,
      qreWeights } = parseRankingInfo(result.rankingInfo);
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
    //We need to remove the QRE weights from the docWeightTotal
    qreWeights.map((key) => {
      let total = key.score;
      docWeightTotal -= total;
    });
    let totalForPercentageCalc = totalWeight + emptyPart;
    let totalPerc = (docWeightTotal / totalForPercentageCalc) * 100;// * (result.percentScore / 100);
    //docWeightTotal = docWeightTotal * (result.percentScore / 100);
    if (allValues['docs'] == undefined) {
      allValues['docs'] = {};
      allLabels['docs'] = "Document weights";
      allIndexes['docs'] = 0;
      allColors['docs'] = DocumentColor;
    }
    if (allValues['empty'] == undefined) {
      allValues['empty'] = {};
      allLabels['empty'] = "Difference with Number 1";
      allIndexes['empty'] = 1;
      allColors['empty'] = DifferenceColor;
    }
    let totalPercEmpty = (emptyPart / totalForPercentageCalc) * 100;// * (result.percentScore / 100);
    let emptyTotal = ((emptyPart - min['empty']) / (max['empty'] - min['empty']) * 100);
    allValues['empty'][index] = ({ 'm': emptyPart - min['empty'], 'v': emptyPart, 'vp': Math.round(totalPercEmpty), 'y': emptyTotal, 'x': index + 1, 'mi': min['empty'], 'ma': max['empty'] });

    let docWeight = docWeightTotal;
    docWeightTotal = ((docWeightTotal - min['docs']) / (max['docs'] - min['docs']) * 100);
    //if (docWeightTotal == 0) docWeightTotal = -5;
    allValues['docs'][index] = ({ 'm': docWeight - min['docs'], 'v': docWeight, 'vp': Math.round(totalPerc), 'y': docWeightTotal, 'x': index + 1, 'mi': min['docs'], 'ma': max['docs'] });

    //terms document weights ******************
    // colors = [];
    // console.log(termsWeight);
    Object.keys(termsWeight).map((key) => {
      let label = key;
      let total = 0;
      Object.keys(termsWeight[key]['Weights']).map((keyT) => {
        total += termsWeight[key]['Weights'][keyT];
      });
      totalPerc = (total / totalForPercentageCalc) * 100;// * (result.percentScore / 100);
      //total = (parseInt(total * (result.percentScore / 100)));
      if (allValues['Term' + label] == undefined) {
        allValues['Term' + label] = {};
        allLabels['Term' + label] = "Term weights for:|" + label.trim();
        allIndexes['Term' + label] = Object.keys(allIndexes).length;
        allColors['Term' + label] = TermColor;
      }
      let totalVal = total;
      total = ((total - min['Term' + label]) / (max['Term' + label] - min['Term' + label]) * 100);
      //if (total == 0) total = -5;
      allValues['Term' + label][index] = ({ 'm': totalVal - min['Term' + label], 'v': totalVal, 'vp': Math.round(totalPerc), 'y': total, 'x': index + 1, 'mi': min['Term' + label], 'ma': max['Term' + label] });

    });
    //qre document weights ******************
    qreWeights.map((key) => {
      let total = key.score;
      let label = key.expression;
      let field = key.fields;

      if (total != 0) {
        totalPerc = (total / totalForPercentageCalc) * 100;// * (result.percentScore / 100);
        //total = parseInt(total * (result.percentScore / 100));
        if (label.indexOf('permanentid') > 0 && total > 0) {
          if (allValues['ART'] == undefined) {
            allValues['ART'] = {};
            allLabels['ART'] = "Boosted by ART";
            allIndexes['ART'] = Object.keys(allIndexes).length;
            allColors['ART'] = ARTColor;
          }
          let totalVal = total;
          let neg = false;
          if (totalVal < 0) neg = true;
          total = ((Math.abs(total) - min['ART']) / (max['ART'] - min['ART']) * 100);
          if (neg) {
            total = -total;
            if (total < -100) {
              total = -100;
            }
          }
          //if (total == 0) total = -5;
          allValues['ART'][index] = ({ 'm': totalVal - min['ART'], 'v': totalVal, 'vp': Math.round(totalPerc), 'y': total, 'x': index + 1, 'mi': min['ART'], 'ma': max['ART'] });


        } else {
          //Check if we already have the fields, if so, add it to the same?
          let colorToChoose = DNEColor;
          let title = label;

          if (currentFields.includes(field)) {
            colorToChoose = currentColors[field];
            title = field + "|" + label;
          } else {
            currentColors[field] = specificColors[Object.keys(currentColors).length];
            currentFields.push(field);
            colorToChoose = currentColors[field];
            title = field + "|" + label;
          }
          //Check if expression is inside the rankingExpressions and isConstant: true ==> then it is QRE else DNE
          let isDNE = false;
          rankingExpressions.map((expr) => {
            if (expr.expression == label && expr.isConstant == false) {
              isDNE = true;
            }
          });
          if (isDNE) {
            //colors.push(DNEColor);
            //labels.push('DNE: ' + label);
            if (allValues['DNE' + field] == undefined) {
              allValues['DNE' + field] = {};
              allLabels['DNE' + field] = 'Boosted by DNE|' + title;
              allIndexes['DNE' + field] = Object.keys(allIndexes).length;
              allColors['DNE' + field] = colorToChoose;
            }
            let totalVal = total;
            let neg = false;
            if (totalVal < 0) neg = true;
            if (max['DNE' + field] - min['DNE' + field] == 0) total = 0; else
              // if (max['DNE' + field] < 0) {
              //   let temp = min['DNE' + field];
              //   min['DNE' + field] = max['DNE' + field];
              //   max['DNE' + field] = temp;
              // }
              total = ((Math.abs(total) - min['DNE' + field]) / (max['DNE' + field] - min['DNE' + field]) * 100);

            if (neg) {
              total = -total;
            }
            if (total < -100) {
              total = -100;
            }
            //if (total == 0) total = -5;
            allValues['DNE' + field][index] = ({ 'm': totalVal - min['DNE' + field], 'v': totalVal, 'vp': Math.round(totalPerc), 'y': total, 'x': index + 1, 'mi': min['DNE' + field], 'ma': max['DNE' + field] });


          } else {
            if (allValues[field] == undefined) {
              allValues[field] = {};
              allLabels[field] = 'Boosted by QRE|' + title;
              allIndexes[field] = Object.keys(allIndexes).length;
              allColors[field] = colorToChoose;
            }
            let totalVal = total;
            // if (max[field] < 0) {
            //   let temp = min[field];
            //   min[field] = max[field];
            //   max[field] = temp;
            // }
            let neg = false;
            if (totalVal < 0) neg = true;
            if (max[field] - min[field] == 0) total = 0; else
              total = ((Math.abs(total) - min[field]) / (max[field] - min[field]) * 100);

            if (neg) {
              total = -total;
            }
            if (total < -100) {
              total = -100;
            }

            //if (total == 0) total = -5;
            allValues[field][index] = ({ 'm': totalVal - min[field], 'v': totalVal, 'vp': Math.round(totalPerc), 'y': total, 'x': index + 1, 'mi': min[field], 'ma': max[field] });
          }
        }
      }
    });
  });
  //Now we have everything. Construct the chart data
  let chartIndex = Object.keys(allIndexes).sort(function (a, b) { return allIndexes[a] - allIndexes[b] });
  let chartData = [];
  let labels = [];
  for (let index = 0; index < chartIndex.length; index++) {
    const element = chartIndex[index];
    let label = allLabels[element];
    let color = allColors[element];
    labels.push({ label: label, color: color });
    let data = [];
    for (let indexr = 0; indexr < results.length; indexr++) {
      //if (indexr <= 3) {
      const result = allValues[element];
      if (result[indexr] == undefined) {
        data.push({ 'x': indexr + 1, 'v': 0, 'y': 0, 'vp': 0, 'mi': min[element], 'ma': max[element] });
      } else {
        data.push(result[indexr]);
      }
      //}
    }
    let typeChart = 'bar';
    //if (index == 0) typeChart = 'line';
    chartData.push({ type: typeChart, order: index, label: label, data: data, borderWidth: 1, backgroundColor: color });
  }
  return { chartData, allBarLabels, labels };
}

function processTheResults(info) {
  firstTotal = 0;
  currentColors = {};
  currentFields = [];
  //First processAll The Results
  let { chartData, allBarLabels, labels } = processAllResults(info.results, info.rankingExpressions);
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

          let thediv = $(addChartDiv(result, index, labels, chartData)).insertBefore(element.parentElement);
          let from = 0;
          let to = 0;
          from = index - 1;
          if (from < 0) from = 0;
          to = from + 3;
          if (to > info.results.length) {
            to = info.results.length;
            from = to - 3;
          }
          //
          drawChart(thediv[0].firstElementChild, thediv[0].firstElementChild.nextElementSibling, thediv[0].children[2], result, index, from, to, info.rankingExpressions, chartData, allBarLabels);
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

chrome.runtime.sendMessage({
  action: "contentJsLoaded",
  url: window.location.toString()
});

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

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

const parseExpression = (value) => {
  const REGEX_FIELDS =
    /@(.*?)=/g;
  let exprRegexResult = REGEX_FIELDS.exec(value);

  const fields = [];
  while (exprRegexResult) {
    let field = exprRegexResult[1];
    if (field.indexOf('_') > 0) {
      field = field.substring(field.indexOf('_') + 1)
    }
    field = field.replace('_', ' ').toProperCase();

    fields.push(field);
    exprRegexResult = REGEX_FIELDS.exec(value);
  }

  let fieldText = '';
  fieldText = fields.join(' ');
  return fieldText;
}

const parseQREWeights = (value) => {
  const REGEX_EXTRACT_QRE_WEIGHTS =
    /Expression:\s"(.*)"\sScore:\s(?!0)([-0-9]+)\n+/g;

  let qreWeightsRegexResult = REGEX_EXTRACT_QRE_WEIGHTS.exec(value);

  const qreWeights = [];
  while (qreWeightsRegexResult) {
    qreWeights.push({
      expression: qreWeightsRegexResult[1],
      score: parseInt(qreWeightsRegexResult[2], 10),
      fields: parseExpression(qreWeightsRegexResult[1])
    });
    qreWeightsRegexResult = REGEX_EXTRACT_QRE_WEIGHTS.exec(value);
  }

  return qreWeights;
};

function drawChart(/*ctxbar,*/ ctxradar1, ctxradar, ctx, result, index, from, to, rankingExpressions, barChartData, allBarLabels) {
  //rankingExpressions contains all the ranking expressions with isConstant: true ==> is QRE else it is DNE
  if (result.rankingInfo == null) {
    ctx.parentElement.style.display = 'none';
    return;
  }

  //Create Bar Chart
  let newdata = [];
  let radarlabels = [];
  let radardatasets = [];
  let radardatasets1 = [];
  let newlabels = [];
  let first = true;
  //We want to see the differences of the current result compared to the 2 other ones
  //First get the index one
  let reference = [];
  for (let dat = 0; dat < barChartData.length; dat++) {
    let dataobject = {};
    dataobject['data'] = [];
    for (let x = 0; x < 1; x++) {
      //if (x == index) {
      dataobject['data'].push(barChartData[dat].data[x]);
      //}
    }
    reference.push(dataobject);
  }

  let piecolors = [];
  let piedata = [];
  let pielabels = [];

  for (let dat = 0; dat < barChartData.length; dat++) {
    let dataobject = {};
    let indexs = 0;
    //empty should not be used in the barcharts, only in the piechart
    piecolors.push(barChartData[dat].backgroundColor);
    pielabels.push(barChartData[dat].label);

    if (barChartData[dat].backgroundColor != DifferenceColor) {
      let label = barChartData[dat].label;
      if (label.indexOf('|') > 0) {
        let labels = label.split('|');
        label = [labels[0], labels[1]];
      }
      radarlabels.push(label);
      dataobject['label'] = barChartData[dat].label;
      dataobject['borderWidth'] = barChartData[dat].borderWidth;
      dataobject['backgroundColor'] = barChartData[dat].backgroundColor;
      dataobject['parsing'] = {};
      dataobject['parsing']['key'] = 'y';
      dataobject['parsing']['yAxisKey'] = 'y';
      dataobject['parsing']['xAxisKey'] = 'x';
      dataobject['data'] = [];
      for (let x = from; x < to; x++) {
        if (first) newlabels.push(allBarLabels[x]);
        let data = JSON.parse(JSON.stringify(barChartData[dat].data[x]));
        if (x == index && data['v'] > 0) piedata.push(data);
        if (x == 0) { } else {
          //let y = reference[dat].data[0]['y'] - data['y'];
          let y = data['y'] - reference[dat].data[0]['y'];
          data['y'] = y;
          data['f'] = reference[dat].data[0]['v'];
        }
        dataobject['data'].push(data);
        //if (index == x) radardata.push(data);
        indexs = indexs + 1;
      }
      newdata.push(dataobject);
      //radaralldata.push(radar)
      first = false;
    } else {
      for (let x = from; x < to; x++) {
        let data = JSON.parse(JSON.stringify(barChartData[dat].data[x]));
        if (x == index) piedata.push(data);
        indexs = indexs + 1;
      }
    }
  }
  //for radar it must be x, barChartData instead of the other way around
  //dataset: label = x
  //         data = barChartData
  let indext = 0;
  let radcolors = ['rgb(255, 205, 86,0.2)',
    'rgb(255, 99, 132,0.2)',
    'rgb(54, 162, 235,0.4)'];
  let radlinecolors = ['rgb(255, 205, 86)',
    'rgb(255, 99, 132',
    'rgb(54, 162, 235,0.4)'];


  //Only take 0 and current index
  if (index !== 0) {
    for (let x = index; x < index + 1; x++) {
      let radarobject = {};
      let radarobject1 = {};
      radarobject['label'] = x + 1;
      radarobject['parsing'] = {};
      radarobject['parsing']['key'] = 'y';
      radarobject['parsing']['yAxisKey'] = 'y';
      radarobject['parsing']['xAxisKey'] = 'x';
      //radarobject['borderWidth'] = barChartData[dat].borderWidth;
      radarobject['backgroundColor'] = radcolors[indext];
      radarobject['borderColor'] = radlinecolors[indext];
      radarobject['fill'] = true;
      radarobject['order'] = 1;
      radarobject['data'] = [];
      for (let dat = 0; dat < barChartData.length; dat++) {
        if (barChartData[dat].backgroundColor != DifferenceColor) {
          let data = JSON.parse(JSON.stringify(barChartData[dat].data[x]));
          //radarobject['data'].push(data['y']);
          radarobject['data'].push(data);
        }
      }
      radarobject1 = JSON.parse(JSON.stringify(radarobject));
      radardatasets.push(radarobject);
      radarobject1['parsing']['key'] = 'v';
      radardatasets1.push(radarobject1);
      indext += 1;
    }
  } else {
    indext += 1;
  }

  for (let x = 0; x < 1; x++) {
    let radarobject = {};
    let radarobject1 = {};
    radarobject['label'] = x + 1;
    radarobject['parsing'] = {};
    radarobject['parsing']['key'] = 'y';
    radarobject['parsing']['yAxisKey'] = 'y';
    radarobject['parsing']['xAxisKey'] = 'x';
    //radarobject['borderWidth'] = barChartData[dat].borderWidth;
    radarobject['backgroundColor'] = radcolors[indext];
    radarobject['borderColor'] = radlinecolors[indext];
    radarobject['fill'] = true;
    radarobject['order'] = 0;
    radarobject['data'] = [];
    for (let dat = 0; dat < barChartData.length; dat++) {
      if (barChartData[dat].backgroundColor != DifferenceColor) {
        let data = JSON.parse(JSON.stringify(barChartData[dat].data[x]));
        radarobject['data'].push(data);
      }
    }
    radarobject1 = JSON.parse(JSON.stringify(radarobject));
    radardatasets.push(radarobject);
    radarobject1['parsing']['key'] = 'v';
    radardatasets1.push(radarobject1);
    indext += 1;
  }

  // const myBarChart = new Chart(ctxbar, {
  //   type: 'bar',
  //   plugins: ['chartjs-plugin-annotation'],
  //   data: {
  //     labels: newlabels,
  //     datasets: newdata
  //   },
  //   options: {
  //     //indexAxis: 'y',

  //     plugins: {
  //       annotation: {
  //         annotations: {
  //           box1: {
  //             type: 'box',
  //             xMin: (index - from) - 0.5,
  //             xMax: (index - from) + 0.5,
  //             yMin: -100,
  //             yMax: 100,
  //             backgroundColor: 'rgba(255, 99, 132, 0.15)'
  //           }
  //         }
  //       },
  //       tooltip: {
  //         callbacks: {
  //           label: function (context) {
  //             let labels = context.dataset.label.split('|');
  //             //console.log(context);
  //             labels.push('');
  //             labels.push('Value: ' + parseInt(context.raw.v));
  //             if (context.raw.mi) {
  //               labels.push('Min:' + parseInt(context.raw.mi) + ', Max: ' + parseInt(context.raw.ma));
  //             }
  //             labels.push('Difference (max-min-first): ' + parseInt(context.raw.y) + '%');
  //             let prefix = "Reduces ";
  //             let val = context.raw.y;
  //             if (context.raw.y > 0) {
  //               prefix = "Increases ";
  //             } else {
  //               val = -val;
  //             }
  //             labels.push(prefix + "the final ranking with " + parseInt(val) + '% ');
  //             if (context.raw.f) {
  //               labels.push('First result value: ' + parseInt(context.raw.f));
  //             }
  //             return labels;
  //           }
  //         }
  //       },
  //       legend: {
  //         display: false,
  //         position: 'bottom'
  //       }
  //       , title: {
  //         display: true,
  //         text: 'Total Score: ' + result.score,
  //       },
  //       subtitle: {
  //         display: true,
  //         padding: {
  //           top: 5,
  //           bottom: 10
  //         },
  //         text: 'Result number ' + (from + 1) + ' to ' + (to) + '. Percentages related to first result.'
  //       }
  //     },
  //     responsive: false,



  //   }
  // });
  // //console.log(result.rankingInfo, result.percentScore);
  // let score = result.percentScore;
  // let emptyPart = 0;
  // let { documentWeights,
  //   termsWeight,
  //   totalWeight,
  //   qreWeights } = parseRankingInfo(result.rankingInfo);
  // let labels = ['Difference with Number 1', 'Document'];
  // let scores = [];
  // let colors = [DifferenceColor, DocumentColor];
  // let data = [];
  // if (firstTotal == 0) {
  //   firstTotal = totalWeight;
  //   emptyPart = 0;
  // } else {
  //   emptyPart = firstTotal - totalWeight;
  // }
  // //first document weights ******************
  // let docWeightTotal = 0;
  // Object.keys(documentWeights).map((key) => {
  //   docWeightTotal += documentWeights[key];
  // });
  // //We need to remove the QRE weights from the docWeightTotal
  // qreWeights.map((key) => {
  //   let total = key.score;
  //   docWeightTotal -= total;
  // });
  // data.push(parseInt(emptyPart));// * (result.percentScore / 100)));
  // data.push(parseInt(docWeightTotal));// * (result.percentScore / 100)));
  // // let datasets = [];
  // // datasets.push({ label: 'Document', data: scores, borderWidth: 1, backgroundColor: colors });
  // //terms document weights ******************
  // // colors = [];
  // // console.log(termsWeight);
  // Object.keys(termsWeight).map((key) => {
  //   let label = key;
  //   scores = [];
  //   let total = 0;
  //   Object.keys(termsWeight[key]['Weights']).map((keyT) => {
  //     total += termsWeight[key]['Weights'][keyT];
  //   });
  //   data.push(parseInt(total));// * (result.percentScore / 100)));
  //   colors.push(TermColor);
  //   labels.push('Term: ' + label);
  //   //datasets.push({ label: 'Terms ' + label, data: scores, borderWidth: 1, backgroundColor: colors });
  // });
  // //qre document weights ******************
  // // colors = [];
  // // console.log(termsWeight);
  // qreWeights.map((key) => {
  //   let total = key.score;
  //   let label = key.expression;
  //   let field = key.fields;

  //   if (total != 0) {
  //     data.push(parseInt(total));// * (result.percentScore / 100)));
  //     if (label.indexOf('permanentid') > 0 && total > 0) {
  //       colors.push(ARTColor);
  //       labels.push('ART: ' + label);

  //     } else {
  //       //Check if we already have the fields, if so, add it to the same?
  //       let colorToChoose = DNEColor;
  //       let title = label;
  //       if (currentFields.includes(field)) {
  //         colorToChoose = currentColors[field];
  //         title = field + "|" + label;
  //       } else {
  //         currentColors[field] = specificColors[Object.keys(currentColors).length];
  //         currentFields.push(field);
  //         colorToChoose = currentColors[field];
  //         title = field + "|" + label;
  //       }
  //       //Check if expression is inside the rankingExpressions and isConstant: true ==> then it is QRE else DNE
  //       let isDNE = false;
  //       rankingExpressions.map((expr) => {
  //         if (expr.expression == label && expr.isConstant == false) {
  //           isDNE = true;
  //         }
  //       });
  //       if (isDNE) {
  //         //colors.push(DNEColor);
  //         //labels.push('DNE: ' + label);
  //         colors.push(colorToChoose);
  //         labels.push('DNE: ' + title);

  //       } else {
  //         colors.push(QREColor);
  //         labels.push('QRE: |' + label);
  //       }
  //     }
  //   }
  //   //datasets.push({ label: 'Terms ' + label, data: scores, borderWidth: 1, backgroundColor: colors });
  // });

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
  const myRadar1 = new Chart(ctxradar1, {
    type: 'radar',
    data: {
      labels: radarlabels,
      datasets: radardatasets1
    },
    options: {
      responsive: false,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          min: minAll,
          max: maxAll
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              let labels = [];
              labels.push('Result ' + context.raw.x);
              //labels.push(context.label);
              //console.log(context);
              labels.push('');
              labels.push('Value: ' + parseInt(context.raw.v));
              if (context.raw.mi != undefined) {
                labels.push('Min:' + parseInt(context.raw.mi) + ', Max: ' + parseInt(context.raw.ma));
              }
              //labels.push('Difference (max-min-first): ' + parseInt(context.raw.y) + '%');
              let prefix = "Reduces ";
              let val = context.raw.y;
              if (context.raw.y > 0) {
                prefix = "Increases ";
              } else {
                val = -val;
              }
              if (context.raw.y == 0) {
                prefix = ""
              }
              if (prefix !== "") {
                labels.push(prefix + "the minimum value (" + parseInt(context.raw.mi) + ") with " + parseInt(val) + '% ');
              }
              // if (context.raw.f) {
              //   labels.push('First result value: ' + parseInt(context.raw.f));
              // }
              return labels;
            }
          }
        },
        legend: {
          display: true,
          position: 'top'
        }
        , title: {
          display: true,
          text: 'Comparison with raw values.'
        },
        subtitle: {
          display: true,
          text: index == 0 ? 'Result 1' : 'Result 1 compared to ' + (index + 1),
        }
      },

      // scales: {
      //   y: {
      //     stacked: false
      //   }
      // }
    },
    // interaction: {
    //   intersect: false
    // }

  });
  const myRadar = new Chart(ctxradar, {
    type: 'radar',
    data: {
      labels: radarlabels,
      datasets: radardatasets
    },
    options: {
      responsive: false,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          min: -100,
          max: 100
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              let labels = [];
              labels.push('Result ' + context.raw.x);
              //labels.push(context.label);
              //console.log(context);
              labels.push('');
              labels.push('Value: ' + parseInt(context.raw.v));
              if (context.raw.mi != undefined) {
                labels.push('Min:' + parseInt(context.raw.mi) + ', Max: ' + parseInt(context.raw.ma));
              }
              //labels.push('Difference (max-min-first): ' + parseInt(context.raw.y) + '%');
              let prefix = "Reduces ";
              let val = context.raw.y;
              if (context.raw.y > 0) {
                prefix = "Increases ";
              } else {
                val = -val;
              }
              if (context.raw.y == 0) {
                prefix = ""
              }
              if (prefix !== "") {
                labels.push(prefix + "the minimum value (" + parseInt(context.raw.mi) + ") with " + parseInt(val) + '% ');
              }
              // if (context.raw.f) {
              //   labels.push('First result value: ' + parseInt(context.raw.f));
              // }
              return labels;
            }
          }
        },
        legend: {
          display: true,
          position: 'top'
        }
        , title: {
          display: true,
          text: 'Comparison with relative percentages for each value.'
        },
        subtitle: {
          display: true,
          text: index == 0 ? 'Result 1' : 'Result 1 compared to ' + (index + 1),
        }
      },

      // scales: {
      //   y: {
      //     stacked: false
      //   }
      // }
    },
    // interaction: {
    //   intersect: false
    // }

  });
  // const myChart = new Chart(ctx, {
  //   type: 'pie',
  //   plugins: [ChartDataLabels],
  //   data: {
  //     labels: pielabels,
  //     datasets: [
  //       {
  //         data: piedata,
  //         backgroundColor: piecolors,
  //         parsing: {
  //           key: 'v',
  //           xAxisKey: 'x'
  //         }
  //       }
  //     ]
  //   },
  //   options: {
  //     plugins: {
  //       tooltip: {
  //         callbacks: {
  //           label: function (context) {
  //             let labels = context.label.split('|');
  //             //console.log(context);
  //             labels.push('Value: ' + context.raw.v);
  //             return labels;
  //           }
  //         }
  //       },
  //       datalabels: {
  //         formatter: (value, context) => {
  //           return value.vp + '%';
  //           //return context.chart.data.labels[context.dataIndex] + ' ' + Math.round(value / context.chart.getDatasetMeta(0).total * 100) + "%";
  //           //return Math.round(value / context.chart.getDatasetMeta(0).total * 100) + "%";


  //         },
  //         color: 'black',
  //         anchor: 'end',
  //         clamp: true,
  //         align: 'start',
  //         font: {
  //           size: 14
  //         }
  //       },
  //       legend: {
  //         display: false,
  //         position: 'right'
  //       }
  //       , title: {
  //         display: true,
  //         text: 'Total Score: ' + result.score,
  //       },
  //       subtitle: {
  //         display: true,
  //         text: 'Result ' + (index + 1)
  //       }
  //     },
  //     responsive: false,


  //   }
  // });
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

