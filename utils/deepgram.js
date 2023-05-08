/*
 * PlayGround: https://playground.deepgram.com/
 */

require('dotenv').config();
const { Deepgram } = require("@deepgram/sdk");
const mime = require('mime-types');
const fs = require('fs');


const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const config = {  
    smart_format: true, 
    diarize: true, 
    model: 'nova', 
    language: 'en-US',
    summarize: true,
    detect_topics: true,
    detect_entities: true
};

exports.transcribeRecording = async (inputFile, outputFile = null) => {
    try {
        const mimetype = mime.lookup(inputFile);
        
        const audioSource = {
            stream: fs.createReadStream(inputFile),
            mimetype
        };
    
        const response = await deepgram.transcription.preRecorded(audioSource, config);

        if (outputFile) await fs.promises.writeFile(outputFile, JSON.stringify(response));
    } catch (err) {
        console.error('Error [deepgram.js transcribeRecording]:', err.message ? err.message : err);
        return false;
    }
}


