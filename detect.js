const AhoCorasick = require("ahocorasick");

const streetsJson = require("./streets.json");
console.log(`Loaded streets count: ${streetsJson.result.length}`);
const streets = [...new Set(streetsJson["result"])];
console.log(`Loaded streets count after remove duplicate: ${streets.length}`);
const streetsAC = new AhoCorasick(streets);

const vision = require("@google-cloud/vision");
const CREDENTIALS = {
    type: "service_account",
    project_id: "ocr-guest",
    private_key_id: "56730346e9210000629750b186a85c0d4466ccfb",
    private_key:
        "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCyaH3AJkcaLCDT\nQZjgdUxD+DaYV+HfmZLdm/LL0+k2gnO+XeS0vQvWpOkbXjfovweRIGmAcdkEdH2Y\nW1oDslZR2DR8OI3b2chxpEPYh0p8ZlYrtEPwSaob0F2c84Sn/NC6clJ7vo10a7pg\nZB+wd8SgoH3CdwDM7WD9D3FKuIVyGYpyOVA0GcVDUuvzw5Isj2EnU6A/5o1JjQsA\nIJ1JBZjdlfMaXOGdygcsaCgaZcsSrByeXdTPZp00KcXoIPkHc1ebO3EeOADfS5e0\nRklBw0npMlJcZnTuRICCFqqqFEgkEdH0X6mLvOSY7LLEP9iZr0SMBK5+vCHsqliV\nwPCLOcx3AgMBAAECggEAJ+UD0bb9iVW61WLCy9aPAlf75V8pjDWsSM/5oCi36s+L\nEFOws9XeUtY3pj4QZIRrLcHAtc8/hyaBe1NaMp9rfAvL2MdQuYvercLcxQuj1WOQ\n+17pHk9qsaOLe3BdBq+bAUZVOYSn3xPD7pAVIgH2PzEETjsMO8cNPCl63QmcFaJO\n5cbEt6Qu+AC9XI+/L7O4/OHwnogx0hNGZcdx8QDPqiWAEQVvdCYAfXEwuRRBBqdQ\n+xoH8rIxkWOf82m1JR8kgZfUK3RxxwzFTp+0FW/L/lWzfXb5z80l43anHaEknKxV\nv3h5zvBSxpKSlxq1BXIyzh5IdDuMxAEq/XsN5slp8QKBgQDWd1/RiSUI28hclQyq\n8DT/ZGC7a5gn2F06zZYd9W5fJF5vK9skbX7y9eLXJWoihzWIiYKheriuIRX6x+CM\nnX8pE3Y8LvYiKnKZ9gc/JzmmjTqEhS/+AZVePPW3aiuyD6vGTUIGqc3wXUHrKhgf\nLXItIqUoetSwVMyUi6asBm5aLwKBgQDU9XUqN9uxad6hGF3+SUgCsAyZQKqNuDqw\nFuifSTOJ9PBGfG3aBNLnA6z782lJ2ZfzFcOv5yrUIMTq4gj4Csfe7mi3LKF0BJ3N\nR1+SIMItCw87eD8E7ezSAmPKs1Fo/zFe7aHHt1xLQz4JKrgC7WV910ztVQKOBayO\nqXvf5z3IOQKBgQCU/b9yWP2ChvVN5Do1ssSOvFQ7QAcnfzddd5+XVn8D18dHIkeO\nqgbskQezAYoXTKlTHnzC4/fS+KdFXoBQD8ZcaenU66cQmz6cWQA1znFNlIWXtNNf\neggjvOPTNQ4AGMTz8Y4yBNtN5eu6jLbPSgos8wmb8qE5kt/BPrdegOU+/wKBgQCt\nYJlfIdLvAe6K4TfFCwxhg8r+CjPQ5aiCLGR/Ki2Xp57nA+67jSnXgpqXFXkm8sxO\nz+1djKrFwVgQkq4So1ROH3OJjgB0YD3JHs6kPZ9Y5KQmGqPT85DW+bMdGBizjvA3\nBOitnI67h6c991WQrI3wghTTNF68Gcp+62U6yRz3oQKBgEkdihthtl44EO78rB4v\nuNMC2ggaPDqhfZpoQMidnBnN7+WQFp4mZGSkbBDIA1427lQdFGHI9hp3rP/cf1lR\nGepJ7OwQK3Ac5s6wAGWEd3hwdU6Dfwe6b1yM2E8Yr4RDkdrLq78w5v1yYuoRw35m\n8k60F5uArJ+Gd2xkSJ4/3kWE\n-----END PRIVATE KEY-----\n",
    client_email: "guest-810@ocr-guest.iam.gserviceaccount.com",
    client_id: "103749641225357947984",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
        "https://www.googleapis.com/robot/v1/metadata/x509/guest-810%40ocr-guest.iam.gserviceaccount.com",
    universe_domain: "googleapis.com",
};
const KEYWORDS = ["宮", "廟", "壇", "殿", "府", "台", "堂", "歲"];
const DELTA_X_ALLOWED = 0;
const DELTA_Y_ALLOWED = 20;
const DELTA_D_ALLOWED = 10;
const CONFIG = {
    credentials: {
        private_key: CREDENTIALS.private_key,
        client_email: CREDENTIALS.client_email,
    },
};

const client = new vision.ImageAnnotatorClient(CONFIG);

class AnnotationBox {
    constructor(data) {
        this.vertices = data.boundingPoly.vertices;
        this.text = data.description.replace(" ", "");
        this.center = {
            x: (this.vertices[0].x + this.vertices[2].x) / 2,
            y: (this.vertices[0].y + this.vertices[2].y) / 2,
        };
    }
    canGroupWith(other) {
        let atan2 = Math.atan2(
            this.center.y - other.center.y,
            this.center.x - other.center.x
        );
        let radians = atan2 - Math.atan2(1, 0);
        let degs = Math.abs((radians * 180) / Math.PI);
        let gapX = Math.max(
            this.vertices[0].x - other.vertices[2].x,
            other.vertices[0].x - this.vertices[2].x
        );
        let gapY = Math.max(
            this.vertices[0].y - other.vertices[2].y,
            other.vertices[0].y - this.vertices[2].y
        );

        if (degs > DELTA_D_ALLOWED) return false;
        if (gapX > DELTA_X_ALLOWED) return false;
        if (gapY > DELTA_Y_ALLOWED) return false;
        return true;
    }
}

function MakeGroups(annotations) {
    let boxes = annotations
        .filter((item) => {
            if (!item.description.match(/\p{sc=Han}+/gu)) return false;
            return true;
        })
        .map((item) => {
            return new AnnotationBox(item);
        })
        .sort((a, b) => {
            return a.center.x - b.center.x;
        });
    let groups = [];
    groups.push([boxes.shift()]);
    while (boxes.length) {
        let joining = boxes.filter((box) => {
            let currentGroup = groups[groups.length - 1];
            for (let member of currentGroup) {
                if (box.canGroupWith(member)) {
                    return true;
                }
            }
            return false;
        });
        if (joining.length) {
            groups[groups.length - 1] =
                groups[groups.length - 1].concat(joining);
            for (box of joining) {
                boxes.splice(boxes.indexOf(box), 1);
            }
        } else {
            groups.push([boxes.shift()]);
        }
    }
    return groups;
}

async function Detect(request) {
    let [result] = await client.textDetection(request);
    let annotations = Array.from(result.textAnnotations);
    annotations.shift();

    let groups = MakeGroups(annotations);

    groups = groups.map((group) =>
        group.sort((a, b) => {
            return a.center.y - b.center.y;
        })
    );

    groups = groups.sort((a, b) => {
        return b[0].center.x - a[0].center.x;
    });

    let sentences = groups.map((group) => {
        return group
            .map((member) => {
                return member.text;
            })
            .join("");
    });

    let extracted = [];
    for (let s of sentences) {
        if (KEYWORDS.some((word) => s[s.length - 1] == word)) {
            extracted.push({ isRoad: false, name: s });
            continue;
        } else {
            let res = streetsAC.search(s);
            for (let match of res) {
                for (let word of match[1]) {
                    let appeared = false;
                    for (
                        let i = extracted.length - 1;
                        i >= Math.max(0, extracted.length - 2) &&
                        extracted[i].isRoad;
                        i--
                    ) {
                        if (extracted[i].name == word) {
                            extracted.splice(i, 1);
                        }
                    }
                    if (!appeared) {
                        extracted.push({ isRoad: true, name: word });
                    }
                }
            }
        }
    }
    // console.log(extracted);
    return extracted;

    // let previousCross = [];
    // for(let i=extracted.length-1; i>=0; i--) {
    //     if(extracted[i].isRoad) {
    //         if(previousCross.includes(extracted[i].name)) {
    //             extracted.splice(i, 1);
    //         }
    //         else {
    //             previousCross.push(extracted[i].name);
    //             if(previousCross.length > 2) {
    //                 previousCross.splice(0, 1);
    //             }
    //         }
    //     }
    //     else {
    //         previousCross = [];
    //     }
    // }

    // console.log(extracted);
    // for(let i=0; i<extracted.length-1; ) {
    //     if(extracted.slice(i+1, i+3).some(d=>d.name==extracted[i].name)) {
    //         extracted.splice(i, 1);
    //     }
    //     else {
    //         i += 1;
    //     }
    // }
    // console.log(extracted);

    // let paired = [];
    // let prevRoad = null;
    // for(let i=0; i<extracted.length; i++) {
    //     if(extracted[i].isRoad) {
    //         if(!prevRoad) {
    //             prevRoad = extracted[i].name;
    //         }
    //         else if(extracted[i].name != prevRoad) {
    //             paired.push(prevRoad + '&' + extracted[i].name);
    //             prevRoad = extracted[i].name;
    //         }
    //     }
    //     else {
    //         paired.push(extracted[i].name);
    //     }
    // }
    // console.log(paired);

    // sentences = sentences.filter((sentence) => {
    //     for (word of KEYWORDS) {
    //         if (sentence[sentence.length - 1] == word) {
    //             return true;
    //         }
    //     }
    //     return false;
    // });
    // return sentences;
}

module.exports = Detect;
