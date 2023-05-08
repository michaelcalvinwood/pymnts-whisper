/*
 * PlayGround: https://playground.deepgram.com/
 */

require('dotenv').config();
const { Deepgram } = require("@deepgram/sdk");
const mime = require('mime-types');

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
    const mimeType = mime.lookup(inputFile);
    console.log(mimeType); 
}


