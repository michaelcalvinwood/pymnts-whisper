const { v4: uuidv4 } = require('uuid');

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const axiosTools = require('./utils/axios');

const info = require('./media/visa.json');

const url = 'https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4';
const speakers = [
    'Owen McDonald', 'Mark', 'Josh'
]

/*
 * htmltopdf: https://www.npmjs.com/package/html2pdf.js
 */

async function doStuff() {
    
    const fileName = `./media/${uuidv4()}.mp4`;
    console.log('downloading', fileName);
    await axiosTools.urlToFile(url, fileName)
    console.log('converting to mp3')
    const mp3File = await deepgram.convertMp4ToMp3(fileName);
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return false;
    const jsonFile = mp3File.substring(0, loc) + '.json';
    console.log('creating  raw transcript', mp3File);
    //const info = await deepgram.transcribeRecording(mp3File, jsonFile);

    if (info) {
        const rawTranscript = deepgram.generateSpeakerBasedTranscript(info);
        const speakerChunks = deepgram.splitTranscriptIntoSpeakerChunks(rawTranscript);
        
        console.log('assigning speakers', rawTranscript);
        //const rawChunks = deepgram.splitTranscriptIntoChunks(rawTranscript);


        
        //speakerScript = deepgram.assignSpeakers(rawTranscript, speakers);
        //console.log('cleaning transcript', speakerScript);

        // clean transript in chunks (transcript, speakers)
        
        // Generate list of 10 titles

        // getTags

        // Post to WordPress 
        
        
        // create article

        //console.log(transcript);
    }

    
    
}

doStuff();