const axios = require('axios');
const fs = require('fs');

exports.urlToFile = (url, filePath) => {
    return new Promise(async (resolve, reject) => {
        const writer = fs.createWriteStream(filePath)
    
        let response;
  
        try {
            response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
            })
        } catch (e) {
            console.error(e);
            reject(e);
            return false;
        }
        response.data.pipe(writer)
  
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}


