require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { Configuration, OpenAIApi } = require("openai");



const configuration = new Configuration({
    apiKey: process.env.PYMNTS_OPENAI_KEY,
  });
const openai = new OpenAIApi(configuration);

async function chatCompletion (prompt, service = 'You are a helpful, accurate assistant.') {
    /* 
     * NO NEED TO SPECIFY MAX TOKENS
     * role: assistant, system, user
     */


    const request = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.PYMNTS_OPENAI_KEY}`,
        },
        data: {
            model: "gpt-3.5-turbo",
            temperature: 0,
            messages:[
                {
                    role: 'system',
                    content: service,

                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        }
    }

    return axios(request);
}


exports.transcribeAudio = async (inputFileName, outputFileName) => {
    const transcript = await openai.createTranscription(
      fs.createReadStream(inputFileName),
      "whisper-1"
    );

    await fsPromises.writeFile(outputFileName, transcript.data.text);
    return;
}

exports.cleanTranscriptChunk = async (chunk) => {
    let prompt = process.env.CLEANUP_TRANSCRIPT_PROMPT + chunk;
    if (!prompt.endsWith("\n")) prompt += "\n";

    let result;

    try {
        result = await chatCompletion(prompt);
        //console.log('result.data.choices', result.data.choices[0].message);
    } catch (err) {
        console.error("axios err.data", err.response.status, err.response);
        return {
            status: 'error',
            message: err.response,
        }
    }
    //console.log('result.data', result.data);


    const response = {
        status: 'success',
        finishReason: result.data.choices[0].finish_reason,
        content: result.data.choices[0].message.content
    }

    //console.log(response);

    return response;
}