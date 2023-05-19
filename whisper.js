const httpsPort = 6400;
const privateKeyPath = '/etc/letsencrypt/live/node.pymnts.com/privkey.pem';
const fullchainPath = '/etc/letsencrypt/live/node.pymnts.com/fullchain.pem';

const { v4: uuidv4 } = require('uuid');

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const axiosTools = require('./utils/axios');
const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

const cleanedChunksJSON = require('./cleanedChunks.json');

const createArticleFromCleanedChunks = async () => {
    let cleanedChunks = cleanedChunksJSON;
    let article;
    let result;
    let curArticleChunk;
    if (cleanedChunks.length === 1) {
        result = await ai.fullArticle(cleanedChunks[0]);
        article = result.content;
    } else {
        for (let i = 0; i < cleanedChunks.length; ++i) {
            console.log('message', `Using AI to write the article based on chunk #${i+1} of ${cleanedChunks.length}. This can take several minutes.`);
            if (i === 0) {
                result = await ai.startArticle(cleanedChunks[i]);
                console.log('startArticle', result.content);
                article = result.content;
            } else {
                if (i === cleanedChunks.length - 1 ) {
                    result = await ai.endArticle(cleanedChunks[i], curArticleChunk);
                   // console.log(result);
                    console.log('endArticle', result.content);
                }
                else {
                    result = await ai.continueArticle(cleanedChunks[i], curArticleChunk);
                    console.log('continueArticle', result.content);
                }
                article += result.content;
            }
            curArticleChunk = result.content;
        }
        
    }
}
//createArticleFromCleanedChunks();

// const info = require('./media/visa.json');

const url = 'https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4';

/*
 * htmltopdf: https://www.npmjs.com/package/html2pdf.js
 */

async function test() {
    let cleanedChunks = fs.readFileSync('./cleanedChunks.json', 'utf-8');
    cleanedChunks = JSON.parse(cleanedChunks);

    speakerAssignedChunks = null;

    //console.log('cleanedChunks', cleanedChunks);
    console.log('testing');

    let article;
    if (cleanedChunks.length === 1) {
        let result = await ai.fullArticle(cleanedChunks[0]);
        article = result.content;
        socket.emit('article', article);
    } else {
        for (let i = 0; i < cleanedChunks.length; ++i) {
            if (i === 0) {
                let result = await ai.startArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article = result.content;
            } else {
                let result;
                if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i], article);
                else result = await ai.continueArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article += result.content;
            }
            break;
        }
    }
}
//test();

const sleep = seconds => new Promise(r => setTimeout(r, seconds * 1000));


const downloadMp4 = async url => {
    const fileName = `./media/${uuidv4()}.mp4`;
    const videoName = url.substring(url.lastIndexOf('/')+1);

    try {
        await axiosTools.urlToFile(url, fileName)
    } catch (err) {
        console.error(err);
        return false;
    }
    return fileName;
}

const convertMp4ToMp3 = async fileName => {
    let mp3File;
    try {
        mp3File = await deepgram.convertMp4ToMp3(fileName);
    } catch (err) {
        console.error(err);
        return false;
    }
    
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return false;

    return mp3File
}

const handleUrl = async (socket, url) => {
    console.log('the url is ', url);


    let urlInfo;
    try {
        urlInfo = new URL(url);
    } catch (err) {
        return socket.emit('error', 'invalid url');
    }

    const extension = url.substring(url.lastIndexOf('.'));

    if (extension !== '.mp4') return socket.emit('error', 'URL is not .mp4');
    
    socket.emit('message', `Downloading video`)
    const fileName = await downloadMp4(url);
    if (!fileName) return socket.emit('error', `Could not download video. Please try again later.`)
    
    socket.emit('message', `Converting video file into an audio file.`);

    let mp3File = await convertMp4ToMp3(fileName);
    if (mp3File === false) socket.emit('error', `Could not convert videot to audio file.`);

    let loc = mp3File.indexOf('.mp3');
    const jsonFile = mp3File.substring(0, loc) + '.json';
   
    socket.emit ("Transcribing the audio file into raw words.");
    const info = await deepgram.transcribeRecording(mp3File, jsonFile);
    if (!info) return socket.emit('error', 'Could not transcribe the video.');

    const speakers = deepgram.getSpeakers(info);
    socket.emit('speakers', speakers);

    socket.emit('message', 'Generating raw transcript.');
    let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);
    console.log('rawTranscript', rawTranscript);

    socket.emit('transcript', rawTranscript);
    socket.emit('rawTranscript', rawTranscript);
    socket.emit('done', 'ready for speaker input');
    return;

    //console.log('urlInfo', urlInfo);
}

// const handleSpeakers = async (socket, info) => {
//     const { rawTranscript, speakerList } = info;
//     console.log('handleSpeakers', rawTranscript);

//     socket.emit('gotSpeakers', 'got them');

//     socket.emit ('message', 'Assigning speakers to transcript.');
    
//     let speakerChunks = deepgram.getSpeakerChunks(rawTranscript);

//     console.log('speakerChunks', speakerChunks)

//     let transcriptChunks = deepgram.getTranscriptChunks(speakerChunks);
//     speakerChunks = null;

//     let speakerAssignedChunks = [];
//     for (let i = 0; i < transcriptChunks.length; ++i) {
//         speakerAssignedChunks.push(deepgram.assignSpeakers(transcriptChunks[i], speakerList));
//     }
//     socket.emit('transcript', speakerAssignedChunks.join("\n"));

//     console.log('speakerAssignedChunks', speakerAssignedChunks);

//     transcriptChunks = null;

//     const cleanedChunks = [];

//     for (let i = 0; i < speakerAssignedChunks.length; ++i) {
//         socket.emit('message',`Using AI to clean up imperfections in transcript chunk #${i+1} of ${speakerAssignedChunks.length}. This can take several minutes.`);
//         let result;
        
//         result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i], 'turbo', socket);
        
//         if (result.status === 'error') return socket.emit('error', 'ChatGPT servers are down. Please try again later.');
//         console.log(`Cleaned Chunk #${i+1} of ${speakerAssignedChunks.length}`, result);
//         cleanedChunks.push(result.content);
//         fs.writeFileSync(`transcriptChunk${i+1}.txt`, result.content);
//         socket.emit('transcript', cleanedChunks.join("\n"));
//     }

//     fs.writeFileSync('cleanedChunks.json', JSON.stringify(cleanedChunks));
//     fs.writeFileSync('cleanedTranscript.txt', cleanedChunks.join("\n"));
    
//     // return socket.emit('message', "chunks ready for debugging");

//     // let cleanedChunks = fs.readFileSync('./cleanedChunks.json', 'utf-8');
//     // cleanedChunks = JSON.parse(cleanedChunks);

//     speakerAssignedChunks = null;

//     console.log('cleanedChunks', cleanedChunks);

//     let article;
//     if (cleanedChunks.length === 1) {
//         socket.emit('message', `Using AI to write the article. This can take several minutes.`);
//         let result = await ai.fullArticle(cleanedChunks[0]);
//         article = result.content;
//         socket.emit('article', article);
//     } else {
//         for (let i = 0; i < cleanedChunks.length; ++i) {
//             socket.emit('message', `Using AI to write the article based on chunk #${i+1} of ${cleanedChunks.length}. This can take several minutes.`);
//             if (i === 0) {
//                 let result = await ai.startArticle(cleanedChunks[i]);
//                 console.log('result.content', result.content);
//                 article = result.content;
//                 socket.emit('article', article);
//             } else {
//                 let result;
//                 if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i], article);
//                 else result = await ai.continueArticle(cleanedChunks[i]);
//                 console.log('result.content', result.content);
//                 article += result.content;
//                 socket.emit('article', article);
//             }
//         }
//     }

//     socket.emit('done', 'articleComplete');
// }




const testTranscript = `Speaker 0: Hello, everyone. I'm Hal Libby with Penn com. I'm joined today by Mark Taunton, who is the head of customer success with North America at Form 3. Welcome. We're happy to have you.

Speaker 1: Hi, Al. Great to meet you.

Speaker 0: Great to be with you. We're discussing today the ship that is underway and certainly in the future. Going to be there away from batch payments toward real time payments. It's a significant opportunity It's also got its share of challenges. So we'll be discussing both.

Let's get started with this sort of 10000 foot view. If we're looking at what the pain points are that are in place, at banks examining the infrastructure they have in place. To deal with payments and then to deal with things in the back end. I'd love to get your thoughts. What not working when we think about legacy operations?

At the same time, some things are working and don't necessarily need to be overwhelmed. Tell me your thoughts there.

Speaker 1: Certainly. So, yeah, there's the traditional payment rails, the, you know, the single high value transactions or the the bulk batch low value transactions, they've evolved over a long time. Right? They've been in place many, many years. So they've come to, I suppose, achieve a certain efficiency around those requirements, and there's been lots of effort to make better tooling and improve the process insofar as it can be improved.

But ultimately, the core restriction is you have to swap files, you have to send books of payments together. Because the technology at the ultimate, the central infrastructures hasn't been able to manage the volume of payments on a 1 by 1 basis, right? So the legacy infrastructures around that batch process I would say, you know, are relatively fit for purpose for a lot of use cases, you know, paying monthly salaries. You know the date that's coming up, you can prepare everything in advance. And that process is quite well embedded when it works.

And then you get the the unhappy path where you need to change someone's account details or someone has left the firm and you don't want to pay them that month, how do you pick that single transaction out of your bulk batch process? What's the risk and control framework around that? How do you then manage your resulting reconciliations? Do you have a break between your bulk, debit at the bank versus your records internally. And that brings a lot of manual overhead and processing into the kind of the cleanup from that.

Coupled with that, you are passing bulky files around. You have to make certain cutoff times at certain points of the day, or you or you missed the next settlement cycle. So these inherent limitations that really can't be overcome. That the world of immediate payments really can address and and bring better solutions to these things.

Speaker 0: There's some some of the things you mentioned there that that have been a little bit that they worked until they haven't. Here's a thought are we headed toward an environment where real time payments will replace all batch payments, or are there You mentioned use cases, you know, it depends on the use case. Are are are we headed toward a blanket future where batch payments ultimately will go away where might we see a coexistence with pockets of of of resilience for batch?

Speaker 1: Yeah. I think it's certainly that latter case, a coexistence. And if we look at the UK, as a prime example, real time has been here for quite some time. But if I look at the the volumes of payments, transactions going through to the back scheme versus the faster payment scheme. Back still has a bit of a lead.

It's pretty close. An FPS, I think, is catching up year on year. But it's still kind of 60 40 in favor of batch. I think where you see a lot of the growth and the volume of the real time payments is new use cases, and that's partially supported by just a shift in the modern world. You're more gig workers, people who want to get paid daily weekly, they don't want to wait for a monthly cycle.

Immediately payments allows you adapt to those type of use cases much more easily, you know, without upending your existing bulk process. So, I mean, depending how far into the future you want to look, I think it is just gonna be real time payments increasing their market share year on year on year. But there'll be a long tail, I think. And part of that, I suppose, is the perceived challenges of making the shift in your infrastructure and processes to a real time world, and that'd be at the corporate level and at the banking level. You know, as consumers, we're getting far more used to immediate everything.

And again, I mentioned the UK where I'm based. You know, I can send money on my mobile phone in my app, you know, actively real time settlement through the banks to any anyone else who lived in the UK. So I'm used to that. The corporate world is a little further behind because to unpick what they have, they maybe quite don't see the full benefit to do that yet.

Speaker 0: With with with the duality of the banks and the corporates having to make the shift, is there a mindset shift that I need to occur when grappling with technology, is there a hesitancy that you think might be out there? Is it because of a technological challenge or even a worry that, you know, hey, how do we begin? What do we start to embrace? To get there?

Speaker 1: I think there's a yeah. I think there's a perceived hurdle on the initial change that would need to happen. You know, and, you know, as a senior payments figure out 1 of the main US bank said to me recently, the the real time pain connecting into the scheme isn't really the difficult bit. The the work is the upstream to that point. So if you're used to batch processing, you have your on our 3 day cycle.

You have your book debits at your at your bank. Moving to a 24 7 always on world. Can seem daunting, absolutely. So it's not just the question of, technically, how do I connect into a new API based system, for example, but how do I keep my processes like banks would shut their books at you know, 11PM every night to clear everything up for the day and then they start off fresh the next day. But what happens if money is still coming in?

Money coming in at 2AM on a Sunday morning through a real time payment system. How do you adapt to that? And, you know, the various schemes have rules and requirements around giving use of funds to customers, so it's not just your books and your record. It's actually put pushing that up through the channels to your retail customers, your your corporate So that I can see how that would seem quite daunting. I think that kind of the change in mindset that you allude to is 1 that needs to be a little more medium term benefit.

So a a little bit of upfront pain if you like that you may not see the benefit day 1, but it is actually teeing you up for a much better future and future proof as the world just continues to move into this real time processing world, you are proof future proofing yourself against future developments, future enhancements, etcetera. I think a lot of organizations I mean, they're always swamped with mandatory change from regulators and new products they wanna get out So it can be harder to take a medium to longer term view on spend some money on change now because you won't necessarily see the benefits immediately. But actually, this type of change, I think, requires that slightly longer term view.

Speaker 0: You have 2 concepts in there. I wanna dove into a little bit. Because it leaves room for discussion of APIs. It's the idea of future proofing. The idea of connectivity and maybe streamlining some of these transitioned, we've been talking about really with PI splitting with this idea and execution.

And more than that, what is the single API approach? And and why is it an optimal 1 in your mind?

Speaker 1: Yep. So, I mean, I I've I've worked in in banks in my career before. I was at Form 3, more in the the kind of the high value payments and the the batch payments. And, yeah, I've seen file, FTP transfer, various ways of sharing information. And I thought, you know, when I came into the API role, that's just another way to to send data.

They didn't appreciate till a bit more recently the real, the flexibility that they give you. Both in terms of speed to try things out, you know, try connect to something, try it out. You know, we've had we've had customers who can have connect to us within a day. You know, I've never seen a file connection get set up that quickly ever. So there's that kind of ability to try things at a much lower cost, you know, proof of concept pilot, whatever you want to call it.

That's 1 thing. But also the flexibility to do more with that data. So being able to integrate with APIs across all the multiple systems you may have in your banking, where you'd have a ledge, you'll have an investigation system, you have a customer service system. They can all be fed independently from any set of APIs that give the right information to those who need than having to take a single source trying to filter it out or trying to get your training your people to ignore the bits they don't need to see. You just send them the bits they do need to see that that help them.

It also gives you that kind of decoupling from some of your more core systems as well. So anytime you wanna make a change, you're not going through months of regression testing. You know, I've been in institutions where maybe they could get 1 or 2 change cycles in a year because the amount of regression testing they needed to do, because they're worried about unexpected knock on consequences is huge. And those delivery, those change cycles are always oversubscribed, and it really just slows down the pace of change and ultimately of making your customers' lives better with better solutions and better products. If you then take that to the next level of kind of single API, the more simplification you can have the easier life is gonna be.

You know, you you're not trying to code your systems against multiple things. You're not having to worry about which market is this payment going to because the API is handling all of that for you. And ultimately what this does is frees up your resources to focus on your customer's journey, your customer experience, where you can really differentiate yourselves against your competitors.

Speaker 0: Is that a a way of more a jointly managing RMB spend which certainly has its own pressure now, right in the current macro environment every dollar account. But I think you're alluding to getty that if you're leveraging the API, you're freeing up some of the R and D and tech budgets that would normally be back and you're dealing and dealing with all of these other things and change cycle you've mentioned, you have to do. Now you can allocate their dialogue more to the end user or end customer or other parts of the relationship. And maybe it's fair to say, we have 30 dollars to be innovative rather than reactive to the changes that need to be done?

Speaker 1: That's exactly right. The, you know, What's overlooked a lot during these kind of change programs is the resulting run costs of that of that change as well. They quickly come out of different parts of the budget, different people responsible for them. All the things we've talked about, say, in the API world, in terms simplifying the change event carries on into then the simplification of the ongoing run of that service as well. You have less maintenance, less overhead, and it, as you say, ultimately frees up your dollar spend and they probably these days more importantly, your people, your people resources, to work with your your sales team, your product team to come up with more innovative solutions, either maybe catch up a little bit with your competitors if you feel fall behind or steal a march on them.

You know, there are so many new payment use cases coming out. And, you know, almost every day, it seems like, you know, the know pay later and different ways to move your money. And customers, consumers, I think, increasingly vote with their feet. If they see a better service somewhere else, it's quite easy now because it's just download a separate app on your phone and you're up and running, right? So, I think that customer retention piece becomes more and more challenging, and you want to be able to focus your resources on that as much as possible.

Speaker 0: So much of what we're talking about is going to be crystalized when bed now comes to the forefront and to, you know, an official launch we're only a few weeks away. So tell me a little bit about what we're discussing. The API the idea of moving away from batch, the ways in which we can get some innovative use cases out there. How does all this wind up being synthesized to get help banks get ready for it, but now, when it launches. And then for faster payment in general no matter where we're looking.

Speaker 1: Mhmm. I think what I'd let's say is don't don't try and kinda rush into just something tactical to just think I can connect to this, and it is problem solved. As I said earlier on in the session, a lot of the work adapting to real time payments is in the upstream. It's your cores and your channels upstream. So I think it does need a well thought through planned change project.

I think some connecting to an API based service like ours allows you get in quickly and start playing around for want of a better word, you know, get your developers used to handling the data flows, and it can help inform that strategy of where do we need to start, first, where do we need to put the initial effort, It means you can start bringing your operational teams in, your production support teams in quite early to see what it's going to look like. So rather than run it with a project team who then disappear and you hand it over and they're like, well, we don't really know. This looks really new. You can get everyone involved very early on because we have full capability simulators where you can be testing the actual kind of flows that you'll see in the real world from day 1. As I mentioned, I think it does take a little bit of a more medium term view.

Don't expect amazing results overnight in terms of realizing those benefits. But it means you can start talking to your customers from a position of we have this, and let's figure out how best to use it together. Means you can start marketing yourselves as well, so you're not looking like you're falling behind. And I think the other thing is probably don't expect it to solve everything overnight as well. You know, as I said, there are use cases where batch will will stay around for quite a while.

I mean, we still see checks being used. Right? There are use cases for these older payment mechanisms, which will take time to to tie down. So don't expect it to be a panacea for everything. Really just embrace the new things it will let you do and let you give to your customers.

Speaker 0: I think that's a great point. It's more of an evolution. So I'm gonna expect to be a revolution, but it'll be an evolutionary moodled over the longer term. I think that's a good point. Mark, I wanna thank you for the time for the conversation.

Speaker 1: Great speaking with

Speaker 0: you, Hal.

Speaker 1: Thank you.

Speaker 0: It's been a pleasure.`;

const testSpeakers = ['Hal Levey', 'Mark Staunton']








const getCurrentSpeaker = (paragraph, curSpeaker) => {
    if (!paragraph.startsWith('Speaker')) return curSpeaker;

    const loc = paragraph.indexOf(':');
    if (loc === -1) return curSpeaker;
    
    const test = paragraph.substring(8, loc);
    if (isNaN(test)) return curSpeaker;

    return Number(test);
    
}

async function getCleanedTranscript (chunk) {
    const prompt = `"""The transcript below was generated by ai in the following format: Speaker Name: Utterance. The Speaker Names preceded by a colon are accurate. Correct the transcript utterances as follows. Correct the sentences where people stutter to make them read smoothly. Rewrite numbers and numeric references in human friendly format. The company producing this transcript is PYMNTS and its website is PYMNTS.com. Be sure to return the entire corrected transcript including all speaker names and all their corrected utterances.\n\nTranscript:\n${chunk.paragraphs.join("\n")}"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.cleanedTranscript = response.status === 'success' ? response.content : false;
}

async function getTheFacts (chunk) {
    const prompt = `"""Make a list of every fact, idea, notion, and concept that can be extracted from the following transcript:\n\nTranscript:\n${chunk.cleanedTranscript}\n"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.facts = response.status === 'success' ? response.content : false;
}

async function createInitialParagraphs (chunk) {
    const numParagraphs = Math.ceil(chunk.size / 350);

    console.log('numParagraphs', numParagraphs);

    const prompt = `"""Write a dynamic and engaging first ${numParagraphs > 1 ? `${numParagraphs} paragraphs` : "paragraph"} of a news article using the Facts, Ideas, Notions, and Concepts provided below:\n\n${chunk.facts}\n"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.3);
    
    chunk.initialArticle = response.status === 'success' ? response.content : false;
}

async function insertQuotes (chunk) {
    const numQuotes = Math.ceil(chunk.size / 450);
    const addition = numQuotes > 1 ? `${numQuotes} relevant quotes` : '1 relevant quote';

    const prompt = `"""Below is the beginning of a News Article and a related Transcript. Expand this news article by incorporating at least ${addition} from the provided Transcript.
    News Article:
    ${chunk.initialArticle}
    Transcript:
    ${chunk.cleanedTranscript}"""\n`

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.insertedQuotes = response.status === 'success' ? response.content : false;
}

function rewriteInAnEngagingStyle (article) {
    return new Promise(async (resolve, reject) => {
        const prompt = `"""In the style of a eloquent author, rewrite the following News Article in a dynamic and conversational manner. Ensure your response preserves all the quotes in the news article. The response must be at least 800 words.
        News Article:
        ${article.initialArticle}\n"""\n`;
        
        let response = await ai.getTurboResponse(prompt, 0.4);
        
        article.engagingArticle = response.status === 'success' ? response.content : false;
        resolve('ok');
    })
}

function getTagsAndTitles (article, numTitles = 10) {
    return new Promise(async (resolve, reject) => {
        const prompt = `"""Give ${numTitles} interesting titles for the provided News Article below.
    Also generate a list of tags that include the important words and phrases in the response. 
    The list of tags must also include the names of all people, products, services, places, companies, and organizations mentioned in the response.
    Also generate a conclusion for the news article.
    The return format must be stringified JSON in the following format: {
        "titles": array of titles goes here
        "tags": array of tags go here
        "conclusion": conclusion goes here
    }
    News Article:
    ${article.initialArticle}\n"""\n`;

        let response = await ai.getTurboResponse(prompt, 0.4);
            
        article.titleTags = response.status === 'success' ? response.content : false;
        resolve('ok')
    })
}

function transformChunk (chunk) {
    return new Promise(async (resolve, reject) => {
        await getCleanedTranscript(chunk);
        if (chunk.cleanedTranscript === false) return reject ('Could not clean chunk.');
            
        await getTheFacts(chunk);
        if (chunk.facts === false) return reject ('Could not extract facts');

        await createInitialParagraphs(chunk);
        if (chunk.initialArticle === false) return reject ('Could not create initial article from facts.');
            
        await insertQuotes(chunk);
        if (chunk.insertedQuotes === false) return reject ('Could not insert quotes into the initial article.');
           
        resolve('ok');
    })
}

async function createDynamicArticle (transcript, speakers, socket) {

    console.log(transcript, speakers);
    
    let published = [];
    /*
     * Assign a speaker to every paragraph
     */
    let curSpeaker = -1;
    let paragraphs = transcript.split("\n");
    for (let i = 0; i < paragraphs.length; ++i) {
        const paragraph = paragraphs[i];
        if (!paragraph) {
            published.push('');
            continue;
        }
        curSpeaker = getCurrentSpeaker(paragraph, curSpeaker);
        if (curSpeaker >= speakers.length) curSpeaker = -1;
        const speakerName = curSpeaker === -1 ? 'Unknown' : speakers[curSpeaker];
        const loc = paragraph.indexOf(':');
        if (!paragraph.startsWith('Speaker')) {
            published.push(paragraphs[i]);
            paragraphs[i] = `${speakerName}: ${paragraph}`;
        }
        else {
            paragraphs[i] = `${speakerName}${paragraph.substring(loc)}`;
            published.push(paragraphs[i]);
        }
    }

    let publishedTranscript = published.join("\n");
    console.log('publishedTranscript');
    socket.emit('publishedTranscript', publishedTranscript);
    /*
     * Calculate the number of words
     */
    let numWords = 0;
    for (let i = 0; i < paragraphs.length; ++i) {
        let words = paragraphs[i].split(" ");
        numWords += words.length ? words.length : 1;
    }
    console.log('numWords', numWords);

    /*
     * Split transcript paragraphs into chunks needed
     */
    const numChunks = Math.ceil(numWords / 1200);
    const chunkSize = numWords / numChunks;

    console.log('numChunks', numChunks, chunkSize);
    
    let chunks = [];
    let curChunk = 0, curSize = 0;
    chunks[curChunk] = {paragraphs: []}
    for (let i = 0; i < paragraphs.length; ++i) {
        let words = paragraphs[i].split(" ");
        numWords = words.length ? words.length : 1;
        if (curSize + numWords > chunkSize && curChunk < numChunks - 1) {
            chunks[curChunk].size = curSize;
            ++curChunk;
            chunks[curChunk] = {paragraphs: []};
            curSize = 0;
        }
        chunks[curChunk].paragraphs.push(paragraphs[i]);
        curSize += numWords;
    }
    chunks[curChunk].size = curSize;

    /*
     * Process each chunk independently
     */
    paragraphs = null;
    transcript = null;
    speakers = null;

    let transformations = [];
    for (let i = 0; i < chunks.length; ++i) {
       let task = transformChunk(chunks[i]);
       transformations.push(task);
    }

    console.log('waiting for tasks', transformations);
    await Promise.all(transformations);

    let article = {};
    const initialArticleArray = [];
    for (let i = 0; i < chunks.length; ++i) initialArticleArray.push(chunks[i].insertedQuotes);    
    article.initialArticle = initialArticleArray.join("\n");
    chunks = null;

    transformations = [];

    console.log('INITIAL ARTICLE', article.initialArticle);
    
    let articleWords = article.initialArticle.split(" ").length;

    console.log('articleWords', articleWords);

    let finalArticle = rewriteInAnEngagingStyle(article);
    let titleTags = getTagsAndTitles(article);

    await Promise.all([finalArticle, titleTags]);

    console.log('FINAL ARTICLE:', article);

    return article;

}

const handleSpeakers = async (socket, info) => {
    const { rawTranscript, speakerList } = info;
    console.log('handleSpeakers', rawTranscript);

    socket.emit('gotSpeakers', 'got them');

    socket.emit ('message', 'Updating the transcript now.');
    
    await createDynamicArticle(rawTranscript, speakerList, socket);

    socket.emit('done', 'articleComplete');

    socket.emit('article', article);
}


//createDynamicArticle(testTranscript, testSpeakers);
const socketConnection = socket => {

    console.log('connection', socket.id);

    socket.on('url', (url) => handleUrl(socket, url));
    socket.on('speakers', (speakerList) => handleSpeakers(socket, speakerList));
}

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);

const io = require('socket.io')(httpsServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

io.on('connection', socket => {
    socketConnection(socket);
    // client.on('connection', (socket) => socketConnection(socket));
    // client.on('event', data => { console.log(data) });
    // client.on('disconnect', () => { console.log('disconnected', client.id)});
});

httpsServer.listen(httpsPort,  () => {
    console.log(`HTTPS Server running on port ${httpsPort}`);
});
