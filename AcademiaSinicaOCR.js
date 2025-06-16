const FormData = require("form-data");
const axios = require("axios");
const util = require("util");
const fs = require("fs");

const BASE_URL = "https://ocr.ascdc.tw/web_api";

function WrapErrorMsg(errmsg) {
    console.error(errmsg);
    return new Error(errmsg);
}

class AcademiaSinicaOCR {
    #token = "";
    #tokenExpireTime = 0;

    constructor(config) {
        this.config = config;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        };
    }

    async LoginAsync() {
        this.#token = "";
        this.#tokenExpireTime = 0;
    
        const account = this.config["ApiSettings:Account"] || "";
        const password = this.config["ApiSettings:Password"] || "";
    
        if(!account || !password) {
            throw WrapErrorMsg("無法讀取帳號或密碼，請確認 appsettings.json 設定");
        }

        const formData = new FormData();
        formData.append("account", account);
        formData.append("password", password);

        try {
            const response = await axios.post(`${BASE_URL}/auth.php`, formData, {
                headers: {...formData.getHeaders(), ...this.headers},
            });

            if(Math.floor(response.status/100) != 2 || response.data["status"] != 200) {
                throw WrapErrorMsg(`登入失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }

            if(response.data && response.data["access_token"]) {
                this.#token = response.data["access_token"];
                this.#tokenExpireTime = Date.now() + 8.64e7;
                return response.data["access_token"];
            }
            else {
                throw WrapErrorMsg(`無法解析密鑰，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }
        }
        catch(error) {
            if(error.response) {
                throw WrapErrorMsg(`請求錯誤，狀態碼：${error.response.status}，回應數據：${util.inspect(error.response.data, false, null, true)}`);
            }
        }
    }

    async CreateBookAsync(title, author, isPublic, orientation) {
        if(Date.now() > this.#tokenExpireTime) {
            await this.LoginAsync();
        }

        const formData = new FormData();
        formData.append("token", this.#token);
        formData.append("title", title);
        formData.append("author", author);
        formData.append("public", +isPublic);
        formData.append("orientation", orientation);

        try {
            const response = await axios.post(`${BASE_URL}/create_book.php`, formData, {
                headers: {...formData.getHeaders(), ...this.headers},
            });

            if(Math.floor(response.status/100) != 2 || response.data["status"] != 200) {
                throw WrapErrorMsg(`建立藏書失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }

            if(response.data && response.data["bookid"]) {
                return response.data["bookid"];
            }
            else {
                throw WrapErrorMsg(`建立藏書失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }
        }
        catch(error) {
            if(error.response) {
                throw WrapErrorMsg(`請求錯誤，狀態碼：${error.response.status}，回應數據：${util.inspect(error.response.data, false, null, true)}`);
            }
        }
    }

    async UploadImageAsync(file, bookId, blockOrder) {
        if(Date.now() > this.#tokenExpireTime) {
            await this.LoginAsync();
        }

        const formData = new FormData();
        formData.append("token", this.#token);
        formData.append("page", file.buffer, file.name);
        formData.append("bookid", bookId);
        formData.append("block_order", blockOrder);

        try {
            const response = await axios.post(`${BASE_URL}/upload.php`, formData, {
                headers: {...formData.getHeaders(), ...this.headers},
            });

            if(Math.floor(response.status/100) != 2 || response.data["status"] != 200) {
                throw WrapErrorMsg(`上傳影像失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }

            if(response.data && response.data["queue_id"]) {
                return response.data["queue_id"];
            }
            else {
                throw WrapErrorMsg(`上傳影像失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }
        }
        catch(error) {
            if(error.response) {
                throw WrapErrorMsg(`請求錯誤，狀態碼：${error.response.status}，回應數據：${util.inspect(error.response.data, false, null, true)}`);
            }
        }
    }

    async QueryProgressAsyncOnce(queueId) {
        if(Date.now() > this.#tokenExpireTime) {
            await this.LoginAsync();
        }

        const formData = new FormData();
        // formData.append("token", this.#token);
        formData.append("queue_id", queueId);

        try {
            const response = await axios.post(`${BASE_URL}/queue.php`, formData, {
                headers: {...formData.getHeaders(), ...this.headers, Authorization:`Bearer ${this.#token}`},
            });

            if(Math.floor(response.status/100) != 2 || response.data["status"] != 200) {
                if(response.status == 103 || response.data["status"] == 103) return;
                throw WrapErrorMsg(`查詢失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }

            if(response.data && response.data["guids"] && response.data["guids"][0]["guid"]) {
                return response.data["guids"][0]["guid"];
            }
            else {
                throw WrapErrorMsg(`查詢失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }
        }
        catch(error) {
            if(error.response) {
                throw WrapErrorMsg(`請求錯誤，狀態碼：${error.response.status}，回應數據：${util.inspect(error.response.data, false, null, true)}`);
            }
        }
    }

    async QueryProgressAsync(queueId, tries=60, sleep=10) {
        for(let i = 0; i < tries; i++) {
            console.log(`嘗試查詢進度 ${i}`);
            let guid = await this.QueryProgressAsyncOnce(queueId);
            if(guid) return guid;
            await new Promise((res, rej) => setTimeout(res, sleep*1000));
        }
        throw WrapErrorMsg(`查詢進度失敗，嘗試次數：${tries}，嘗試間隔：${sleep}s`);
    }

    async GetRecognitionResultAsync(guid) {
        if(Date.now() > this.#tokenExpireTime) {
            await this.LoginAsync();
        }

        const formData = new FormData();
        formData.append("token", this.#token);
        formData.append("guid", guid);

        try {
            const response = await axios.post(`${BASE_URL}/query.php?guid=${guid}`, formData, {
                headers: {...formData.getHeaders(), ...this.headers, Authorization:`Bearer ${this.#token}`},
            });

            if(Math.floor(response.status/100) != 2 || response.data["status"] != 200) {
                throw WrapErrorMsg(`取得辨識結果失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }

            if(response.data && response.data["result"]) {
                return response.data["result"];
            }
            else {
                throw WrapErrorMsg(`取得辨識結果失敗，狀態碼：${response.status}，回應數據：${util.inspect(response.data, false, null, true)}`);
            }
        }
        catch(error) {
            if(error.response) {
                throw WrapErrorMsg(`請求錯誤，狀態碼：${error.response.status}，回應數據：${util.inspect(error.response.data, false, null, true)}`);
            }
        }
    }

    async TextDetection(file, orientation=1, blockOrder="TBRL", retries=60, sleep=10) {
        if(Date.now() > this.#tokenExpireTime) {
            await this.LoginAsync();
        }

        /*
        orientation
            1: 直書
            0: 橫書
            2: 自動偵測
        */
        const bookId = await this.CreateBookAsync(`OCR${Date.now()}TITLE`, `OCR${Date.now()}AUTHOR`, false, orientation);
        console.log(`新增藏書成功 ${bookId}`);

        /*
        blockOrder
            TBRL: 上到下右到左 (右到左的直書)
            TBLR: 上到下左到右 (左到右的直書)
            RLTB: 右到左上到下 (右到左的橫書)
            LRTB: 左到右上到下 (左到右的橫書)
        */
        const queueId = await this.UploadImageAsync(file, bookId, blockOrder);
        console.log(`上傳影像成功 ${queueId}`);

        const guid = await this.QueryProgressAsync(queueId, retries, sleep);
        console.log(`查詢進度完成 ${guid}`);

        await new Promise((res, rej) => setTimeout(res, 10000));

        const result = await this.GetRecognitionResultAsync(guid);
        console.log(`辨識結果 ${util.inspect(result, false, null, true)}`);

        fs.writeFileSync(`${file.name.split(".")[0]}.json`, JSON.stringify(result, null, 4));

        return result;
    }
}

async function Main() {
    try {
        const client = new AcademiaSinicaOCR(require("./appsettings.json"));

        const token = await client.LoginAsync();
        console.log(`登入成功 ${token}`);

        /*
        orientation
            1: 直書
            0: 橫書
            2: 自動偵測
        */
        const bookId = await client.CreateBookAsync(`OCR${Date.now()}TITLE`, `OCR${Date.now()}AUTHOR`, false, 1);
        console.log(`新增藏書成功 ${bookId}`);

        /*
        blockOrder
            TBRL: 上到下右到左 (右到左的直書)
            TBLR: 上到下左到右 (左到右的直書)
            RLTB: 右到左上到下 (右到左的橫書)
            LRTB: 左到右上到下 (左到右的橫書)
        */
        const queueId = await client.UploadImageAsync("./examples/image2.jpg", bookId, "TBRL");
        console.log(`上傳影像成功 ${queueId}`);

        const guid = await client.QueryProgressAsync(queueId, 60, 1);
        console.log(`查詢進度完成 ${guid}`);

        const result = await client.GetRecognitionResultAsync(guid);
        console.log(`辨識結果 ${util.inspect(result, false, null, true)}`);

        return result;
    } catch (error) {
        console.error(`操作失敗：${error.message}`);
    }
}
// Main();

module.exports = AcademiaSinicaOCR;
