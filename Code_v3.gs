/**
 * Azaadi Ka Tadka — Trivia Backend v3
 *
 * IMPORTANT:
 * - Paste this file into the Google Apps Script project that owns your trivia Sheet.
 * - Deploy it as a Web App: Execute as Me + Who has access: Anyone.
 * - v3 intentionally exposes a JSONP GET API instead of requiring browser fetch/CORS.
 * - Correct answers stay server-side.
 * - Camera/video never reaches this backend; only integrity events do.
 */

const V3 = {
  VERSION: '3.0',
  QUIZ_SIZE: 20,
  RESULT_SHEET: 'Trivia Results',
  INTEGRITY_SHEET: 'Trivia Integrity',
  DEVICE_PREFIX: 'V3_DEVICE_',
  SESSION_PREFIX: 'V3_SESSION_',
  MAX_NAME: 60
};

const QUESTION_BANK_V3 = [
  {id:'q1',category:'Independence Movement',difficulty:'medium',question:'The Gandhi-Irwin Pact of March 1931, which secured the release of political prisoners, brought an end to which movement?',options:['Non-Cooperation Movement','Civil Disobedience Movement','Khilafat Movement','Quit India Movement'],correct:1,explanation:'The pact followed the Civil Disobedience Movement and enabled Congress to participate in the Second Round Table Conference.'},
  {id:'q2',category:'Independence Movement',difficulty:'hard',question:'The Ghadar Party, founded in 1913 to organise an armed uprising against British rule, was formed by Indian immigrants based in which country?',options:['United Kingdom','Germany','United States','Japan'],correct:2,explanation:'The Ghadar Party was founded in San Francisco, largely by Indian immigrants on the American West Coast.'},
  {id:'q3',category:'Freedom Fighters',difficulty:'medium',question:'Which freedom fighter proclaimed the Azad Hind Government-in-exile in Singapore in 1943?',options:['Rash Behari Bose','Subhas Chandra Bose','Mohan Singh','Sardar Patel'],correct:1,explanation:'Subhas Chandra Bose declared the Provisional Government of Free India in Singapore in October 1943.'},
  {id:'q4',category:'Freedom Fighters',difficulty:'hard',question:'Who led the 1930 Chittagong Armoury Raid, a daring attack on British armouries in Bengal?',options:['Khudiram Bose','Bagha Jatin','Surya Sen','Rash Behari Bose'],correct:2,explanation:'Surya Sen, popularly known as Master Da, led the raid in April 1930.'},
  {id:'q5',category:'National Symbols',difficulty:'medium',question:"Which animal is designated as India's national aquatic animal?",options:['Gharial','Ganges River Dolphin','Olive Ridley Turtle','Indian Ocean Humpback Dolphin'],correct:1,explanation:"The Ganges River Dolphin was declared India's national aquatic animal in 2009."},
  {id:'q6',category:'National Symbols',difficulty:'hard',question:'Under the Flag Code amendment of 2022, the Indian national flag can now be flown at night under which condition?',options:['Never after sunset','Only atop Parliament House','When it is prominently illuminated','Only during festivals'],correct:2,explanation:'The 2022 amendment allows the tricolour to fly day and night when it is properly illuminated.'},
  {id:'q7',category:'Constitution of India',difficulty:'medium',question:'On which date did the Constitution of India come into effect, an event now celebrated as Republic Day?',options:['15 August 1947','26 November 1949','26 January 1950','2 October 1950'],correct:2,explanation:'The Constitution was adopted on 26 November 1949 and came into force on 26 January 1950.'},
  {id:'q8',category:'Constitution of India',difficulty:'hard',question:"Who presided over the Constituent Assembly that drafted India's Constitution?",options:['Dr. B.R. Ambedkar','Jawaharlal Nehru','Dr. Rajendra Prasad','C. Rajagopalachari'],correct:2,explanation:"Dr. Rajendra Prasad presided over the Constituent Assembly's sessions."},
  {id:'q9',category:'Famous Monuments',difficulty:'medium',question:"Which earlier Mughal monument in Delhi is considered the architectural inspiration for the Taj Mahal's garden-tomb design?",options:['Red Fort',"Humayun's Tomb",'Purana Qila',"Safdarjung's Tomb"],correct:1,explanation:"Humayun's Tomb pioneered the char-bagh garden-tomb style later perfected in the Taj Mahal."},
  {id:'q10',category:'Famous Monuments',difficulty:'hard',question:'The Rani ki Vav, an intricately carved UNESCO-listed stepwell, is located in which Gujarat city?',options:['Ahmedabad','Vadodara','Patan','Bhuj'],correct:2,explanation:'Rani ki Vav stands in Patan, Gujarat.'},
  {id:'q11',category:'Indian Geography',difficulty:'medium',question:"Barren Island, home to India's only active volcano, lies within which Union Territory?",options:['Lakshadweep','Andaman & Nicobar Islands','Daman & Diu','Puducherry'],correct:1,explanation:'Barren Island is part of the Andaman & Nicobar Islands.'},
  {id:'q12',category:'Indian Geography',difficulty:'hard',question:"Which river, notorious for its frequent course changes and devastating floods, is nicknamed the 'Sorrow of Bihar'?",options:['Son','Damodar','Kosi','Gandak'],correct:2,explanation:'The Kosi River is known for dramatic course changes and severe flooding in Bihar.'},
  {id:'q13',category:'Culture & Festivals',difficulty:'medium',question:'The Hornbill Festival, celebrating tribal heritage and culture, is held every December in which state?',options:['Meghalaya','Manipur','Nagaland','Mizoram'],correct:2,explanation:'The Hornbill Festival takes place at Kisama Heritage Village in Nagaland.'},
  {id:'q14',category:'Culture & Festivals',difficulty:'hard',question:'The Kumbh Mela rotates every few years among Prayagraj, Haridwar, Ujjain, and which fourth city?',options:['Varanasi','Nashik','Puri','Rishikesh'],correct:1,explanation:'The four traditional Kumbh Mela cities are Prayagraj, Haridwar, Ujjain and Nashik.'},
  {id:'q15',category:'ISRO & Achievements',difficulty:'medium',question:"Which 2023 ISRO mission carried the Vikram lander and Pragyan rover to a touchdown near the Moon's south pole?",options:['Chandrayaan-2','Chandrayaan-3','Mangalyaan','Aditya-L1'],correct:1,explanation:"Chandrayaan-3's Vikram lander successfully touched down near the Moon's south pole in August 2023."},
  {id:'q16',category:'ISRO & Achievements',difficulty:'hard',question:"India's first dedicated solar observation mission, launched in 2023, was stationed at which Sun-Earth Lagrange point?",options:['L1','L2','L3','L4'],correct:0,explanation:'Aditya-L1 was placed in a halo orbit around Sun-Earth Lagrange Point 1.'},
  {id:'q17',category:'Sports',difficulty:'medium',question:'The final of the 1987 Cricket World Cup, the first edition held outside England, was played in which Indian city?',options:['Mumbai','Kolkata','Delhi','Chennai'],correct:1,explanation:'The 1987 World Cup final was played at Eden Gardens in Kolkata.'},
  {id:'q18',category:'Sports',difficulty:'hard',question:"Who became India's first individual Olympic gold medallist, winning in shooting at the 2008 Beijing Games?",options:['Rajyavardhan Rathore','Abhinav Bindra','Neeraj Chopra','Leander Paes'],correct:1,explanation:'Abhinav Bindra won gold in the 10m air rifle event at Beijing 2008.'},
  {id:'q19',category:'Fun Facts',difficulty:'medium',question:"Which Indian city is nicknamed the 'Silicon Valley of India' for its concentration of IT companies and startups?",options:['Hyderabad','Pune','Bengaluru','Chennai'],correct:2,explanation:'Bengaluru earned this nickname because of its concentration of IT firms, technology parks and startups.'},
  {id:'q20',category:'Fun Facts',difficulty:'hard',question:"India produces roughly three-quarters of the world's supply of which spice, sometimes called 'Indian saffron'?",options:['Cardamom','Turmeric','Saffron','Cumin'],correct:1,explanation:'India is a major producer of turmeric, which is sometimes described as Indian saffron.'}
];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = sanitizeCallback_(p.callback || p.prefix || '');
  let result;
  try {
    result = route_(p);
  } catch (err) {
    result = { ok:false, error: err && err.message ? err.message : String(err) };
  }
  return output_(result, callback);
}

function doPost(e) {
  // Kept for direct/backend testing. The GitHub v3 frontend uses JSONP GET
  // so it does not depend on browser CORS handling.
  let result;
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    result = route_(body);
  } catch (err) {
    result = {ok:false,error:err && err.message ? err.message : String(err)};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  const action = String(p.action || '').trim();
  switch (action) {
    case 'health': return {ok:true,version:V3.VERSION,questions:QUESTION_BANK_V3.length};
    case 'startSession': return startSession_(p);
    case 'getQuestion': return getQuestion_(p);
    case 'submitAnswer': return submitAnswer_(p);
    case 'logIntegrity': return logIntegrity_(p);
    case 'finishSession': return finishSession_(p);
    case 'getLeaderboard': return getLeaderboard_();
    case 'getRevealData': return getLeaderboard_();
    default: throw new Error('Unknown action: ' + action);
  }
}

function startSession_(p) {
  const name = cleanName_(p.name);
  const deviceId = cleanId_(p.deviceId);
  if (!name) throw new Error('Please enter your name.');
  if (!deviceId) throw new Error('A browser device identifier is required.');

  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(V3.DEVICE_PREFIX + deviceId);
  if (existingId) {
    const existing = readSession_(existingId);
    if (existing && existing.status === 'active') return sessionStartResponse_(existing);
    if (existing && existing.status === 'finished') throw new Error('This browser has already completed the trivia.');
  }

  const ids = QUESTION_BANK_V3.map(q => q.id);
  shuffle_(ids);
  const optionOrders = {};
  ids.forEach(id => { optionOrders[id] = shuffle_([0,1,2,3]); });

  const session = {
    id: Utilities.getUuid(),
    name:name,
    deviceId:deviceId,
    questionIds:ids,
    optionOrders:optionOrders,
    currentIndex:0,
    score:0,
    answers:[],
    integrityCount:0,
    startedAt:Date.now(),
    finishedAt:null,
    status:'active'
  };

  writeSession_(session);
  props.setProperty(V3.DEVICE_PREFIX + deviceId, session.id);
  return sessionStartResponse_(session);
}

function sessionStartResponse_(session) {
  return {
    ok:true,
    sessionId:session.id,
    total:session.questionIds.length,
    currentIndex:session.currentIndex,
    question:getPublicQuestion_(session, session.currentIndex)
  };
}

function getQuestion_(p) {
  const session = requireSession_(p.sessionId);
  const index = Number(p.index);
  if (!Number.isInteger(index) || index < 0 || index >= session.questionIds.length) throw new Error('Invalid question index.');
  if (index !== session.currentIndex) throw new Error('Question is not available in this order.');
  return {ok:true,question:getPublicQuestion_(session,index),total:session.questionIds.length};
}

function submitAnswer_(p) {
  const session = requireSession_(p.sessionId);
  if (session.status !== 'active') throw new Error('This trivia session is already closed.');
  const index = Number(p.index);
  const choice = Number(p.choice);
  if (!Number.isInteger(index) || index !== session.currentIndex) throw new Error('Invalid question sequence.');
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new Error('Invalid answer.');

  const q = findQuestion_(session.questionIds[index]);
  const order = session.optionOrders[q.id];
  const originalChoice = order[choice];
  const isCorrect = originalChoice === q.correct;

  session.answers[index] = {choice:choice,correct:isCorrect,at:Date.now()};
  if (isCorrect) session.score++;
  session.currentIndex++;
  writeSession_(session);

  return {
    ok:true,
    accepted:true,
    nextIndex:session.currentIndex,
    complete:session.currentIndex >= session.questionIds.length
  };
}

function logIntegrity_(p) {
  const session = requireSession_(p.sessionId);
  const type = String(p.type || '').slice(0,80);
  if (!type) throw new Error('Integrity event type is required.');
  session.integrityCount = Number(session.integrityCount || 0) + 1;
  writeSession_(session);

  const detail = String(p.detail || '').slice(0,500);
  const sheet = getSheet_(V3.INTEGRITY_SHEET, ['Timestamp','Session ID','Name','Event','Detail']);
  sheet.appendRow([new Date(), session.id, session.name, type, detail]);
  return {ok:true,recorded:true};
}

function finishSession_(p) {
  const session = requireSession_(p.sessionId);
  if (session.status === 'finished') return resultForSession_(session);

  session.status = 'finished';
  session.finishedAt = Date.now();
  writeSession_(session);
  recordResult_(session);
  return resultForSession_(session);
}

function resultForSession_(session) {
  const total = session.questionIds.length;
  const timeSec = Math.max(0, Math.round(((session.finishedAt || Date.now()) - session.startedAt) / 1000));
  return {
    ok:true,
    name:session.name,
    score:session.score,
    total:total,
    timeSec:timeSec,
    integrityEvents:Number(session.integrityCount || 0),
    leaderboard:getLeaderboard_().rows
  };
}

function recordResult_(session) {
  const sheet = getSheet_(V3.RESULT_SHEET, ['Timestamp','Session ID','Name','Score','Total','Time (sec)','Integrity Events']);
  const values = sheet.getDataRange().getValues();
  const exists = values.slice(1).some(r => String(r[1]) === session.id);
  if (exists) return;
  const timeSec = Math.max(0, Math.round((session.finishedAt - session.startedAt) / 1000));
  sheet.appendRow([new Date(),session.id,session.name,session.score,session.questionIds.length,timeSec,Number(session.integrityCount || 0)]);
}

function getLeaderboard_() {
  const sheet = getSheet_(V3.RESULT_SHEET, ['Timestamp','Session ID','Name','Score','Total','Time (sec)','Integrity Events']);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter(r => r[1]).map(r => ({
    name:String(r[2] || 'Player'),
    score:Number(r[3] || 0),
    total:Number(r[4] || V3.QUIZ_SIZE),
    timeSec:Number(r[5] || 0),
    integrityEvents:Number(r[6] || 0)
  }));
  rows.sort((a,b) => b.score - a.score || a.timeSec - b.timeSec || a.name.localeCompare(b.name));
  return {ok:true,rows:rows.slice(0,10),players:rows.length,total:V3.QUIZ_SIZE,average:rows.length ? Math.round(rows.reduce((s,r)=>s+r.score,0)/rows.length*10)/10 : 0};
}

function getPublicQuestion_(session,index) {
  const q = findQuestion_(session.questionIds[index]);
  const order = session.optionOrders[q.id];
  return {
    index:index,
    id:q.id,
    category:q.category,
    difficulty:q.difficulty,
    question:q.question,
    options:order.map(i => q.options[i])
  };
}

function findQuestion_(id) {
  const q = QUESTION_BANK_V3.find(x => x.id === id);
  if (!q) throw new Error('Question not found.');
  return q;
}

function requireSession_(id) {
  const clean = cleanId_(id);
  if (!clean) throw new Error('Session ID is required.');
  const session = readSession_(clean);
  if (!session) throw new Error('Trivia session not found or expired.');
  return session;
}

function readSession_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty(V3.SESSION_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

function writeSession_(session) {
  PropertiesService.getScriptProperties().setProperty(V3.SESSION_PREFIX + session.id, JSON.stringify(session));
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('The Apps Script must be bound to the trivia Google Sheet.');
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function cleanName_(value) {
  return String(value || '').replace(/[<>]/g,'').trim().slice(0,V3.MAX_NAME);
}

function cleanId_(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g,'').slice(0,120);
}

function sanitizeCallback_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(s) ? s : '';
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function shuffle_(array) {
  for (let i=array.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    const t=array[i]; array[i]=array[j]; array[j]=t;
  }
  return array;
}

/** Optional manual setup helper. Run once from the Apps Script editor. */
function setupV3() {
  getSheet_(V3.RESULT_SHEET, ['Timestamp','Session ID','Name','Score','Total','Time (sec)','Integrity Events']);
  getSheet_(V3.INTEGRITY_SHEET, ['Timestamp','Session ID','Name','Event','Detail']);
  Logger.log('Trivia v3 setup complete.');
}
