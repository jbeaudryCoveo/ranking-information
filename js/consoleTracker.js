var contentCRIEnabled = false;
var settings = {};

function copyToClipboard(event, text) {
  //console.log('COPY');
  event.preventDefault();
  event.stopPropagation();
  text = decodeURIComponent(text);
  navigator.clipboard.writeText(text).then(() => {
    // Alert the user that the action took place.
    // Nobody likes hidden stuff being done under the hood!
    alert("Copied to clipboard");
  });
  return true;
}

// function toggleCharts(elem) {
//   chrome.storage.local.set({ showCharts: true });
// }
// function toggleTable(elem) {
//   chrome.storage.local.set({ showTables: true });
// }


const constantMock = window.fetch;
window.fetch = function () {
  return new Promise((resolve, reject) => {
    constantMock.apply(this, arguments)
      .then((response) => {
        if (contentCRIEnabled == false) { resolve(response); return }
        if (response) {
          //resolve(response);
          try {
            response.clone().json() //the response body is a readablestream, which can only be read once. That's why we make a clone here and work with the clone
              .then((json) => {
                //console.log(window['enabled']); 
                if ('totalCount' in json || 'data' in json) {
                  console.log("From Coveo Ranking Info, using windows fetch");
                  //console.log(json);
                  //SendMessage then process it if needed
                  //In case of other clients
                  if ('data' in json) {
                    json = json['data'];
                    if ('product' in json) {
                      json = json['product'];
                    }
                  }
                  window.postMessage({ content: json });
                }
                resolve(response);
              })
              .catch((error) => {
                //console.log("From Coveo Ranking Info");
                //console.log(error);
                reject(response);
              })
          }
          catch (error) {
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