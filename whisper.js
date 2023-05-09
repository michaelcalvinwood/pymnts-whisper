

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const info = require('./media/visa.json');

async function doStuff() {
    //const info = await deepgram.transcribeRecording('./media/visa.mp3', './media/visa.json');

    deepgram.convertMp4ToMp3('./media/visa.mp4');


    if (info) {
        //const transcript = deepgram.generateSpeakerBasedTranscript(info);
        
        //console.log(transcript);
    }

    //const chunks = deepgram.splitTranscriptIntoChunks(transcript);
    
}

doStuff();