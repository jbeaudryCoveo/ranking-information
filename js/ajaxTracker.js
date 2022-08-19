function hijack(url, handler, { method }) {

  return new Promise((resolve, reject) => {
    //  Replace this code later 
    //console.log(handler);
    //console.log('AH:'+url);
    let changed = false;
    let bodyjson = '';
    if (contentCRIEnabled) {
      if (handler.xhr !== undefined) {
        if (handler.xhr.config != undefined) {
          if (handler.xhr.config.body != undefined) {
            bodyjson = JSON.parse(handler.xhr.config.body);
            //Go through complete json if we find 'searchHub or firstResult' then append context
            Object.keys(bodyjson).map((key) => {
              if (key == 'searchHub' || key == 'firstResult') {
                bodyjson['debug'] = true;
                if (bodyjson['context'] == undefined) {
                  bodyjson['context'] = {};
                }
                bodyjson['context']['fromCRI'] = true;
                //console.log('Added CONTEXT CRI');
                changed = true;
              }
              if (typeof bodyjson[key] === "object" && !Array.isArray(bodyjson[key])) {
                //Embedded dictionary
                Object.keys(bodyjson[key]).map((keynest) => {
                  //console.log('keynest:'+keynest);
                  if (keynest == 'searchHub' || keynest == 'firstResult') {
                    bodyjson['debug'] = true;
                    //console.log('keynest MATCH:'+keynest);
                    if (bodyjson[key]['context'] == undefined) {
                      bodyjson[key]['context'] = {};
                    }
                    bodyjson[key]['context']['fromCRI'] = true;
                    //console.log('Added CONTEXT CRI');
                    changed = true;
                  }
                });
              }

            });
          }
        }
      }
    }
    if (changed) {
      //console.log("Changed");
      handler.xhr.config.body = JSON.stringify(bodyjson);
    }
    //console.log(handler);
    resolve();
    //resolve({config:handler.xhr.config, status:handler.xhr.status, headers: handler.xhrProxy.getAllResponseHeaders(), response: handler.xhrProxy.response});
  })
}
if (ah) {
  ah.proxy({
    onRequest: (config, handler) => { /*console.log('AH:');
    console.log(config);*/

      hijack(config.url, handler, config)
        .then(({ response }) => {
          //.then(({ response }) => {
          console.log('AJAX response');
          handler.resolve(response);
          /*return handler.resolve({
            config,
            status: 200,
            headers: [],
            response,
          })*/
        })
        .catch((error) => {/*console.log("AH:");console.log(config);console.log(error);handler.resolve(error);*/ handler.next(config); })
    },


    onResponse: (response, handler) => {
      //console.log("CRI: Ajax response");
      if (contentCRIEnabled) {
        console.log("CRI: Ajax response VALID");
        //console.log(response);
        //console.log(handler);
        if (handler.xhr.responseURL.indexOf('CRIreq') > 0 && handler.xhr.status == 500) {
          //We have a problem, debug is not allowed
          window.postMessage({ removeDebug: true });
        }
        try {
          let jsondata = JSON.parse(response.response);
          console.log(jsondata);
          if ('totalCount' in jsondata || 'data' in jsondata) {
            console.log("From Coveo Ranking Info (Ajax)");
            //console.log(json);
            //SendMessage then process it if needed
            //In case of other clients
            if ('data' in jsondata) {
              jsondata = jsondata['data'];
              if ('product' in jsondata) {
                jsondata = jsondata['product'];
              }
            }
            window.postMessage({ content: jsondata });
          }
          //console.log(jsondata);
        }
        catch {

        }
        handler.resolve(response)
      } else {
        handler.resolve(response)
      }
    },
  })
}