console.log("MyHouseDeals content script loaded 3");

const MAX_REQUEST = 10;
let prevResult;
const leadTypes = {
    WD: 1,
    MS: 2,
    FD: 3,
    MM: 4,
    TF: 5,
    CF: 99,
}

const evalXpath = (xpath, document) => {
    const result = document.evaluate( xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
    );

    return result.snapshotItem(0)?.textContent;
    
}

async function run(msg) {

    return new Promise(async (resolve, reject) => {
        
        
        // Collect the necessary data. 
        console.log("Message received for myhousedeals");
        const addressObj = msg?.address;
        const filters = msg?.params;
        // let prevResult; // = msg?.prevResult;
    
            
            
        const address = addressObj.formatted_address//"6040 n pointe blvd, saint louis, mo 63147";
        // const mhdUrl = "https://www.myhousedeals.com/home.asp"; 
    
        try {
    
            // custom search filters
            let params;
            let result;
            let injectionResults;
    
            if(!prevResult) {
                params = {
                    "SearchARVStart": filters.minARV,
                    "SearchARVEnd": filters.maxARV,
                    "SearchAskingStart": filters.minPrice,
                    "SearchAskingEnd": filters.maxPrice,
                }
                
                injectionResults = await getPropertiesFirstLoad(address, params);
                result = injectionResults;
                prevResult = injectionResults;
                // console.log(injectionResults);
            } else {
                // If continuing
                // injectionResults = await getPropertiesFirstLoad(address, prevResult.params);
                console.log("continuing");
                result = prevResult;
                result.properties = []; 
                // prevResult = injectionResults;
            }
    
    
            for(let requestCount = 0; requestCount < MAX_REQUEST; requestCount++) {
    
                injectionResults = await getProperties(result.next, result.url);
                let currentResults = injectionResults;
                
                result = {
                    ...result,
                    ...currentResults,
                    properties: [...result.properties, ...currentResults.properties]
                }
    
                if(!currentResults.next || result.properties.length > 20)
                    break;
                
            }
    
            // Get page details
            for(let i in result.properties) {
                let p = result.properties[i];

                let headingDetails = await getPropertyHeading(p.id, p.url);
                let propertyDetails = await getPropertyDetails( p.id, p.url );
                // console.log(i, propertyDetails);
                result.properties[i] = {...p, ...propertyDetails, ...headingDetails};
            }
    
            prevResult = result;
            resolve(result);
        } catch(e) {
            // console.log(e);
            reject({
                error: e.message
            });
        }
        
    });
}

async function getPropertiesFirstLoad(address, selectedParams = {}) {
    console.log(address);

    return new Promise(async (resolve, reject) => {
        try {
            // reject(new Error("Test error"));

            let data = new URLSearchParams();
            data.append('search', address);
            data.append('submitBtn', 'Search');

            let result = await fetch("https://www.myhousedeals.com/home.asp", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1"
            },
            "referrer": "https://www.myhousedeals.com/home.asp",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": data.toString(),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
            });

            // console.log(result);

            let html = await result.text();
            let searchUrl = result.url;
            let parser = new DOMParser();
            let doc = parser.parseFromString(html, "text/html");

            let searchInputs = doc.querySelectorAll("#search-box-content-section input");
            let params = {};
            for(let searchInput of searchInputs){
                params[searchInput.getAttribute("name")] = searchInput.value;
            }

            params = {...params, ...selectedParams};

            data = new URLSearchParams(params);
            

            fetch(searchUrl, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1"
            },
            "referrer": "https://www.myhousedeals.com/home.asp",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": data.toString(),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
            }).then(async result => {
                let html = await result.text();
                let url = result.url;
                // console.log(html);

                let parser = new DOMParser();
                let doc = parser.parseFromString(html, "text/html");
                
                const properties = [];
                const propertyCards = doc.querySelectorAll("#properties>div");
                const next = doc.querySelector("#properties>span.lastitems")?.getAttribute("next");

                for(card of propertyCards) {
                    let property = {
                        id: card?.getAttribute("id"),
                        address: card.querySelector(".uk-card-header p")?.innerText,
                        status: card.querySelector(".uk-card-body .uk-article-meta em")?.innerText?.replace("Status: ", ""),
                        arv: card.querySelectorAll("table.uk-table td:nth-child(2)")[0]?.innerText?.replace(/[\$,-]/g, ""),
                        askingPrice: card.querySelectorAll("table.uk-table td:nth-child(2)")[1]?.innerText?.replace(/[\$,-]/g, ""),
                        costOfRepairs: card.querySelectorAll("table.uk-table td:nth-child(2)")[2]?.innerText?.replace(/[\$,-]/g, ""),
                        profitPotential: card.querySelectorAll("table.uk-table td:nth-child(2)")[3]?.innerText?.replace(/[\$,-]/g, ""),
                        image: card.querySelector(".uk-card-header img")?.getAttribute("src"),
                        url: card.querySelector(".uk-card-header a")?.getAttribute("href")
                    }

                    if(property.url)
                        property.url = "https://www.myhousedeals.com" + property.url;

                    if(property?.image?.includes("ImageNotAvailable"))
                        property.image = "https://www.myhousedeals.com/images/ImageNotAvailable_New.jpg";

                    properties.push(property);
                }

                resolve({
                    properties,
                    next,
                    url,
                    params
                });
            });
        } catch(e) {
            resolve({error: e.message});
        }
    });
}

async function getProperties(offset, referrer) {
    return new Promise((resolve, reject) => {

        // throw "test error";
        // reject("test error");
        try {

            fetch(`https://www.myhousedeals.com/property/view/next.asp?offset=${offset}&_=${Date.now()}`, {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": referrer,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
            }).then(async result => {
                let html = await result.text();
                let url = result.url;
                // console.log(html);

                let parser = new DOMParser();
                let doc = parser.parseFromString(html, "text/html");
                
                const properties = [];
                const propertyCards = doc.querySelectorAll("div.just-a-property-item");

                const next = doc.querySelector("span.lastitems")?.getAttribute("next");

                if(propertyCards.length === 0) {
                    resolve({
                        properties,
                        next: null
                    });
                }

                for(card of propertyCards) {
                    let property = {
                        id: card?.getAttribute("id"),
                        address: card.querySelector(".uk-card-header p")?.innerText,
                        status: card.querySelector(".uk-card-body .uk-article-meta em")?.innerText?.replace("Status: ", ""),
                        arv: card.querySelectorAll("table.uk-table td:nth-child(2)")[0]?.innerText?.replace(/[\$,-]/g, ""),
                        askingPrice: card.querySelectorAll("table.uk-table td:nth-child(2)")[1]?.innerText?.replace(/[\$,-]/g, ""),
                        costOfRepairs: card.querySelectorAll("table.uk-table td:nth-child(2)")[2]?.innerText?.replace(/[\$,-]/g, ""),
                        profitPotential: card.querySelectorAll("table.uk-table td:nth-child(2)")[3]?.innerText?.replace(/[\$,-]/g, ""),
                        image: card.querySelector(".uk-card-header img")?.getAttribute("src"),
                        url: card.querySelector(".uk-card-header a")?.getAttribute("href")
                    }

                    if(property.url)
                        property.url = "https://www.myhousedeals.com" + property.url;
                    
                    if(property?.image?.includes("ImageNotAvailable"))
                        property.image = "https://www.myhousedeals.com/images/ImageNotAvailable_New.jpg";

                    properties.push(property);
                }

                resolve({
                    properties,
                    next,
                    url
                });
            });
        } catch(e) {
            resolve({error: e.message});
        }
    });
}

async function getPropertyDetails(id, referrer) {
    return new Promise((resolve, reject) => {

        try {
            let idNum = id.replace(/[A-Z]/g, "");
            let leadType = leadTypes[id.substring(0, 2)];

            fetch(`https://www.myhousedeals.com/include/details/details-information.asp?leadtype=${leadType}&id=${idNum}&_=${Date.now()}`, {
                "headers": {
                    "accept": "text/plain, */*; q=0.01",
                    "accept-language": "en-US,en;q=0.9",
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest"
                },
                "referrer": referrer,
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": null,
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
                }).then(async result => {
                let html = await result.text();
                let url = result.url;
                // console.log(html);

                let parser = new DOMParser();
                let doc = parser.parseFromString(html, "text/html");
                
                let propertyType = evalXpath(`//div[strong[contains(text(), "Property Type")]]`, doc);
                if(propertyType) 
                    propertyType = propertyType.replace(`Property Type:`, "").trim();

                let bedrooms = evalXpath(`//div[strong[contains(text(), "Bedrooms")]]`, doc);
                    if(bedrooms) 
                        bedrooms = bedrooms.replace(`Bedrooms:`, "").trim();
                
                let sqrtFootage = evalXpath(`//div[strong[contains(text(), "Square Footage")]]`, doc);
                    if(sqrtFootage) 
                        sqrtFootage = sqrtFootage.replace(/Square|Footage|:|sqft|,|\s/g, "").trim();

                let bath = evalXpath(`//div[strong[contains(text(), "Bath")]]`, doc);
                    if(bath) 
                        bath = bath.replace(`Bath:`, "").trim();

                resolve({
                    propertyType,
                    beds: bedrooms,
                    area: sqrtFootage,
                    bath
                });
            });
        } catch(e) {
            resolve({error: e.message});
        }
    });
}

async function getPropertyHeading(id, referrer) {
    return new Promise((resolve, reject) => {

        try {

            const leadTypes = {
                WD: 1,
                MS: 2,
                FD: 3,
                MM: 4,
                TF: 5,
                CF: 99,
            }

            let idNum = id.replace(/[A-Z]/g, "");
            let leadType = leadTypes[id.substring(0, 2)];

            fetch(`https://www.myhousedeals.com/include/details/details-heading.asp?leadtype=${leadType}&id=${idNum}&_=${Date.now()}`, {
                "headers": {
                    "accept": "text/plain, */*; q=0.01",
                    "accept-language": "en-US,en;q=0.9",
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest"
                },
                "referrer": referrer,
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": null,
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            }).then(async result => {
                let html = await result.text();
                let url = result.url;
                // console.log(html);

                let parser = new DOMParser();
                let doc = parser.parseFromString(html, "text/html");

                let listingDate;
                let listingDetailsString = evalXpath(`//section[@class="uk-panel"]//p[contains(text(), "Posted:")]`, doc);
                
                if(listingDetailsString) {
                    let listingParts = /Posted:\s([0-9]*\/[0-9]*\/[0-9]*)/.exec(listingDetailsString);
                    if(listingParts)
                        listingDate = listingParts[1];
                }

                resolve({
                    listingDate
                });
            });
        } catch(e) {
            resolve({error: e.message});
        }
    });
}
