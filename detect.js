const AcademiaSinicaOCR = require("./AcademiaSinicaOCR");
const AhoCorasick = require("ahocorasick");

const streetsJson = require("./streets.json");
console.log(`Loaded streets count: ${streetsJson.result.length}`);
const streets = [...new Set(streetsJson.result)];
console.log(`Loaded streets count after removing duplicate: ${streets.length}`);
const streetsAC = new AhoCorasick(streets);

const KEYWORDS = ["宮", "廟", "壇", "殿", "府", "台", "堂", "歲"];

const client = new AcademiaSinicaOCR(require("./appsettings.json"));

async function Detect(file) {
    const result = await client.TextDetection(file, 1, "TBRL", 60, 10);
    // const result = require(`./examples/${file.name.split(".")[0]}.json`);
    result.sort((a, b) => {
        return (
            a["block_id"] - b["block_id"]
        ) || (
            a["line_id"] - b["line_id"]
        ) || (
            a["id"] - b["id"]
        )
    });

    let keySet = new Set();
    let lineByGroupByBlock = {};
    for(let v of result) {
        const {id, line_id, block_id, text} = v;

        let key = `${block_id}-${line_id}`;

        keySet.add(key);

        if(!lineByGroupByBlock[key]) {
            lineByGroupByBlock[key] = [];
        }

        lineByGroupByBlock[key].push({ id: id, text: text });
    }

    let sentences = [];
    for(let key of keySet) {
        lineByGroupByBlock[key].sort((a, b) => (a.id - b.id));
        sentences.push(lineByGroupByBlock[key].map(v=>v.text).join(""));
    }

    let extracted = [];
    for(let s of sentences) {
        if(KEYWORDS.some((word)=>(s[s.length-1] == word))) {
            extracted.push({ isRoad: false, name: s });
        }
        else {
            let res = streetsAC.search(s);
            for(let match of res) {
                for(let word of match[1]) {
                    for(
                        let i = extracted.length - 1;
                        i >= Math.max(0, extracted.length - 2) && extracted[i].isRoad;
                        i--
                    ) {
                        if(extracted[i].name == word) {
                            extracted.splice(i, 1);
                        }
                    }
                    extracted.push({ isRoad: true, name: word });
                }
            }
        }
    }

    return extracted;
}

module.exports = Detect;
