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


const sleep = seconds => new Promise(r => setTimeout(r, seconds * 1000));

async function doStuff() {
    
    const fileName = `./media/${uuidv4()}.mp4`;
    console.log('downloading', fileName);
    await axiosTools.urlToFile(url, fileName)
    console.log('converting to mp3')
    const mp3File = await deepgram.convertMp4ToMp3(fileName);
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return false;
    const jsonFile = mp3File.substring(0, loc) + '.json';
    // console.log("transcribing the mp3 into raw words");
    //const info = await deepgram.transcribeRecording(mp3File, jsonFile);

    if (info) {
        console.log('generating raw transcript', mp3File);
        let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);

        console.log('splitting raw transcript into speaker-based paragraphs');
        let speakerChunks = deepgram.getSpeakerChunks(rawTranscript);
        rawTranscript = '';


        console.log('creating AI-ready transcript chunks')
        let transcriptChunks = deepgram.getTranscriptChunks(speakerChunks);
        speakerChunks = null;

        console.log('assigning speakers to AI chunks');
        let speakerAssignedChunks = [];
        for (let i = 0; i < transcriptChunks.length; ++i) {
            console.log('chunk size', transcriptChunks[i].length, deepgram.getNumWords(transcriptChunks[i]));
            speakerAssignedChunks.push(deepgram.assignSpeakers(transcriptChunks[i], speakers));
        }
        transcriptChunks = null;

       

        const cleanedChunks = [];
        for (let i = 0; i < speakerAssignedChunks.length; ++i) {
            console.log(`Using AI to clean up imperfections in transcript chunk #${i+1}. This can take several minutes.`);
            let result;
            /*
             * IMPORTANT: check if response is serverTooBusy and retry after n minutes where n doubles each time.
             * Send message, ChatGPT Server is Overloaded. Will retry in __ seconds (with countdown)
             */

            result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i]);
            let count = 0;
            let seconds = 30;
            const maxCount = 5;
            while (result.status === 'error') {
                seconds *= 2;
                ++count;
                if (count >= maxCount) return console.error(JSON.stringify(result.message,null, 4));
                console.log(`ChatGPT Error. Waiting ${seconds} seconds and then trying again.`);
                await sleep(seconds);
                result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i]);
            }
            
            cleanedChunks.push(result.content);
        }

        console.log(cleanedChunks);

        

        
        
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