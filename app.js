let raceStartTime
let racePageStartTime

function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.classList.add("hidden")
})

setTimeout(()=>{
document.getElementById(page).classList.remove("hidden")
},50)

}

function getFlag(code){

const flags={
CN:"🇨🇳",
BH:"🇧🇭",
AU:"🇦🇺",
SA:"🇸🇦",
JP:"🇯🇵",
IT:"🇮🇹",
US:"🇺🇸",
ES:"🇪🇸",
CA:"🇨🇦",
MC:"🇲🇨",
AT:"🇦🇹",
GB:"🇬🇧",
HU:"🇭🇺",
BE:"🇧🇪",
NL:"🇳🇱",
SG:"🇸🇬",
MX:"🇲🇽",
BR:"🇧🇷",
QA:"🇶🇦",
AE:"🇦🇪"
}

return flags[code]||"🏁"

}

function formatIST(date){

return new Intl.DateTimeFormat("en-IN",{

timeZone:"Asia/Kolkata",
weekday:"short",
day:"numeric",
month:"short",
hour:"numeric",
minute:"2-digit",
hour12:true

}).format(date)+" IST"

}

function updateRaceStatus(sessions){

const now=new Date()

let first=new Date(sessions[0].date_start)
let last=new Date(sessions[sessions.length-1].date_start)

let status="Upcoming"

if(now>=first && now<=last){
status="Race Week 🟢"
}

if(now>last){
status="Race Finished"
}

document.getElementById("raceStatus").innerText=status

}

function startCountdown(){

function update(){

let diff=raceStartTime-new Date()

if(diff<0){
document.getElementById("countdown").innerText="Race Started"
return
}

let d=Math.floor(diff/86400000)
let h=Math.floor(diff/3600000)%24
let m=Math.floor(diff/60000)%60

document.getElementById("countdown").innerText=
d+"d "+h+"h "+m+"m"

}

update()
setInterval(update,60000)

}

function startRacePageCountdown(){

function update(){

let diff=racePageStartTime-new Date()

if(diff<0){
document.getElementById("racePageCountdown").innerText="Race Started"
return
}

let d=Math.floor(diff/86400000)
let h=Math.floor(diff/3600000)%24
let m=Math.floor(diff/60000)%60

document.getElementById("racePageCountdown").innerText=
d+"d "+h+"h "+m+"m"

}

update()
setInterval(update,60000)

}

async function loadRaceData(){

const res=await fetch("https://api.openf1.org/v1/meetings")
const meetings=await res.json()

const now=new Date()

let nextRace=null

for(let race of meetings){

let start=new Date(race.date_start)

if(start>now){
nextRace=race
break
}

}

if(nextRace){

document.getElementById("raceName").innerText=nextRace.meeting_name
document.getElementById("circuit").innerText=nextRace.circuit_short_name
document.getElementById("location").innerText=
nextRace.location+", "+nextRace.country_name
document.getElementById("flag").innerText=
getFlag(nextRace.country_code)

loadSessions(nextRace.meeting_key)

}

}

async function loadSessions(key){

const res=await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${key}`)
const sessions=await res.json()

const container=document.getElementById("sessionsContent")
container.innerHTML=""

let nextSession=null

sessions.forEach(s=>{

let date=new Date(s.date_start)

let row=document.createElement("div")

row.innerText=s.session_name+" — "+formatIST(date)

container.appendChild(row)

if(!nextSession && date>new Date()){
nextSession=s
}

if(s.session_name==="Race"){
raceStartTime=date
}

})

updateRaceStatus(sessions)

if(nextSession){

document.getElementById("nextSession").innerText=
nextSession.session_name+" — "+formatIST(new Date(nextSession.date_start))

}

startCountdown()

}

async function openRacePage(race,start,end){

showPage("racePage")

document.getElementById("racePageName").innerText=race.meeting_name
document.getElementById("racePageCircuit").innerText=race.circuit_short_name
document.getElementById("racePageLocation").innerText=
race.location+", "+race.country_name

document.getElementById("racePageDates").innerText=

start.toLocaleDateString("en-IN",{day:"numeric",month:"short"})+
" – "+
end.toLocaleDateString("en-IN",{day:"numeric",month:"short"})

const res=await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${race.meeting_key}`)
const sessions=await res.json()

const container=document.getElementById("racePageSessions")
container.innerHTML=""

sessions.forEach(s=>{

let date=new Date(s.date_start)

let row=document.createElement("div")

row.innerText=s.session_name+" — "+formatIST(date)

container.appendChild(row)

if(s.session_name==="Race"){
racePageStartTime=date
}

})

startRacePageCountdown()

}

async function loadCalendar(){

const res=await fetch("https://api.openf1.org/v1/meetings")
const races=await res.json()

const container=document.getElementById("calendarContent")
container.innerHTML=""

const now=new Date()

let next=null
let upcoming=[]

races.forEach(r=>{

let start=new Date(r.date_start)
let end=new Date(start)
end.setDate(end.getDate()+2)

if(start>now && !next){
next={r,start,end}
}
else if(start>now){
upcoming.push({r,start,end})
}

})

function addRace(r,start,end){

let item=document.createElement("div")
item.className="calendar-item"

item.innerHTML=`

<div class="calendar-race">${r.meeting_name}</div>
<div class="calendar-date">
Race Weekend<br>
${start.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
–
${end.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
</div>

`

item.onclick=()=>openRacePage(r,start,end)

container.appendChild(item)

}

if(next){

let title=document.createElement("div")
title.className="calendar-title"
title.innerText="NEXT RACE"

container.appendChild(title)

addRace(next.r,next.start,next.end)

}

if(upcoming.length){

let title=document.createElement("div")
title.className="calendar-title"
title.innerText="UPCOMING RACES"

container.appendChild(title)

upcoming.forEach(x=>addRace(x.r,x.start,x.end))

}

}

/* DRIVER STANDINGS */

async function loadDriverStandings(){

const res=await fetch("https://api.jolpi.ca/ergast/f1/current/driverStandings.json")
const data=await res.json()

const standings=data.MRData.StandingsTable.StandingsLists[0].DriverStandings

const container=document.querySelector("#drivers .card")

let html=`

<h3>Driver Standings</h3>

<table class="standings-table">

<thead>
<tr>
<th class="pos-col">POS</th>
<th class="driver-col">DRIVER</th>
<th class="team-col">TEAM</th>
<th class="points-col">PTS</th>
</tr>
</thead>

<tbody>

`

standings.forEach((d,i)=>{

html+=`

<tr>
<td class="pos-col">${i+1}</td>
<td class="driver-col">${d.Driver.givenName} ${d.Driver.familyName}</td>
<td class="team-col">${d.Constructors[0].name}</td>
<td class="points-col">${d.points}</td>
</tr>

`

})

html+=`</tbody></table>`

container.innerHTML=html

}

/* CONSTRUCTOR STANDINGS */

async function loadConstructorStandings(){

const res=await fetch("https://api.jolpi.ca/ergast/f1/current/constructorStandings.json")
const data=await res.json()

const standings=data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings

const container=document.querySelector("#teams .card")

let html=`

<h3>Constructor Standings</h3>

<table class="standings-table">

<thead>
<tr>
<th class="pos-col">POS</th>
<th class="team-col">TEAM</th>
<th class="points-col">PTS</th>
</tr>
</thead>

<tbody>

`

standings.forEach((t,i)=>{

html+=`

<tr>
<td class="pos-col">${i+1}</td>
<td class="team-col">${t.Constructor.name}</td>
<td class="points-col">${t.points}</td>
</tr>

`

})

html+=`</tbody></table>`

container.innerHTML=html

}

loadRaceData()
loadCalendar()
loadDriverStandings()
loadConstructorStandings()
