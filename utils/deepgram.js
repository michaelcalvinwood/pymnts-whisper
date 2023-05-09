/*
 * PlayGround: https://playground.deepgram.com/
 */

require('dotenv').config();
const { Deepgram } = require("@deepgram/sdk");
const mime = require('mime-types');
const fs = require('fs');
const { exec } = require("child_process");

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const config = {  
    smart_format: true, 
    diarize: true, 
    model: 'nova', 
    language: 'en-US',
    summarize: true
};

exports.convertMp4ToMp3 = fileName => {
    console.log(fileName);
    return new Promise((resolve, reject) => {
        const loc = fileName.indexOf('.mp4');
        if (loc === -1) return reject ('invalid input file');
        const newFile = fileName.substring(0, loc) + '.mp3';
        exec(`ffmpeg -i ${fileName} ${newFile}`, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return reject(error.message);
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return reject(err);
            }
            console.log(`stdout: ${stdout}`);
            return resolve(newFile);
        });
    })
}

exports.transcribeRecording = async (inputFile, outputFile = null) => {
    let response;
    try {
        const mimetype = mime.lookup(inputFile);
        
        const audioSource = {
            stream: fs.createReadStream(inputFile),
            mimetype
        };
    
        response = await deepgram.transcription.preRecorded(audioSource, config);

        if (outputFile) await fs.promises.writeFile(outputFile, JSON.stringify(response));
    } catch (err) {
        console.error('Error [deepgram.js transcribeRecording]:', err.message ? err.message : err);
        return false;
    }

    return response;
}

exports.generateSpeakerBasedTranscript = info => {
    let transcript;

    try {
        transcript = info.results.channels[0].alternatives[0].paragraphs.transcript;
    } catch (err) {
        console.error('Error [deepgram.js generateSpeakerBasedTranscript]:', err.message ? err.message : err);
        return false;
    }

    return transcript;

}

exports.notableQuotes = info => {
    let summaries = info.results.channels[0].alternatives[0].summaries;
    console.log(summaries);

    let sentences = info.results.channels[0].alternatives[0].paragraphs.paragraphs;

    console.log(sentences);
}

exports.splitTranscriptIntoChunks = (transcript, maxChunkSize = 1200) => {
    const sentences = transcript.split("\n");
    console.log(sentences);
}
