console.log("Investorlift.com script loaded");

async function run(msg) {

    return new Promise(async (resolve, reject) => {
        try {
            result = await getProperties();
            resolve(result);
            
        } catch(e) {
            // console.log(e);
            reject({
                error: e.message
            });
        }
        
    });
}


async function getProperties() {
    return new Promise((resolve, reject) => {
        try {
            fetch("https://investorlift.com/api/properties/select", {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            },
            "referrer": "https://investorlift.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "{\"status\":\"\"}",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
            }).then(async result => {
                const data = await result.json();
                resolve(data);
            });
        } catch(e) {
            resolve({error: e.message});
        }
    });
}
