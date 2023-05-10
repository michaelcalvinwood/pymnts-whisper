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

const getResponse = async prompt => {
    if (!prompt.endsWith("\n")) prompt += "\n";

    let result;

    try {
        result = await chatCompletion(prompt);
        //console.log('result.data.choices', result.data.choices[0].message);
    } catch (err) {
        console.error("axios err.data", err.response.status, err.response);
        return {
            status: 'error',
            number: err.response.status,
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

exports.cleanTranscriptChunk = async (chunk) => {
    let prompt = process.env.CLEANUP_TRANSCRIPT_PROMPT + chunk;
    return getResponse(prompt);    
}

exports.startArticle = async initialTranscript => {
    let prompt = `Below is an exerpt of a transcript. You will create the beginning of an article based on this transcript. Your response must be in HTML format. The response must engaging while using the information in the article. Do not create a blow by blow description of the transcript. The response should be approximately 500 words. The response must include two quotes from the transcript. \n\nTranscript:\n${initialTranscript}`;

    return getResponse(prompt);    
}

exports.continueArticle = async transcript => {
    console.log("ai.continueArticle");
}

exports.endArticle = async transcript => {
    console.log("ai.endArticle");
}

exports.fullArticle = async transcript => {
    console.log("ai.fullArticle");
}


