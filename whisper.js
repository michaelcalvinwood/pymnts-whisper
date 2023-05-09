const { v4: uuidv4 } = require('uuid');

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const axiosTools = require('./utils/axios');

const info = require('./media/visa.json');

const url = 'https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4';

async function doStuff() {
    //const info = await deepgram.transcribeRecording('./media/visa.mp3', './media/visa.json');
    const fileName = `./media/${uuidv4()}.mp4`;
    console.log('downloading', fileName);
    await axiosTools.urlToFile(url, fileName)
    console.log('converting to mp3')
    const newFile = await deepgram.convertMp4ToMp3(fileName);
    console.log('converted', newFile);

    if (info) {
        //const transcript = deepgram.generateSpeakerBasedTranscript(info);
        
        //console.log(transcript);
    }

    //const chunks = deepgram.splitTranscriptIntoChunks(transcript);
    
}

doStuff();