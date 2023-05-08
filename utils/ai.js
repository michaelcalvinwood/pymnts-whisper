require('dotenv').config();

const fs = require('fs');
const fsPromises = require('fs').promises;

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
    apiKey: process.env.PYMNTS_OPENAI_KEY,
  });
const openai = new OpenAIApi(configuration);

exports.transcribeAudio = async (inputFileName, outputFileName) => {
    const transcript = await openai.createTranscription(
      fs.createReadStream(inputFileName),
      "whisper-1"
    );

    await fsPromises.writeFile(outputFileName, transcript.data.text);
    return;
  }