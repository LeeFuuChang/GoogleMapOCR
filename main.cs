using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Configuration;
using Utility;

namespace AcademiaSinicaOCR
{
    class Program
    {
        private static readonly HttpClient client = new HttpClient();
        private static string baseUrl = "https://ocr.ascdc.tw/web_api/";

        static async Task Main()
        {
            Console.WriteLine("=== OCR API 測試程式 ===");
            string token = "";
            while (true)
            {
                Console.WriteLine("\n請選擇要執行的步驟：");
                Console.WriteLine("1. 登入並獲取 Token");
                Console.WriteLine("2. 新增藏書");
                Console.WriteLine("3. 上傳影像");
                Console.WriteLine("4. 查詢辨識進度");
                Console.WriteLine("5. 取得辨識結果");
                Console.WriteLine("6. 退出");
                Console.Write("選擇: ");

                string choice = Console.ReadLine();
                switch (choice)
                {
                    case "1":
                        //Console.Write("輸入帳號: ");
                        //string account = Console.ReadLine();
                        //Console.Write("輸入密碼: ");
                        //string password = Console.ReadLine();
                        token = await LoginAsync();
                        if (!string.IsNullOrEmpty(token))
                            Console.WriteLine($"獲取的 Token: {token}");
                        break;

                    case "2":
                        if (string.IsNullOrEmpty(token))
                        {
                            Console.Write("Token 不能為空，");
                            Console.WriteLine("請先執行選項1登入並獲取 Token!");
                            break;
                        }

                        Console.Write("輸入書名: ");
                        string title = Console.ReadLine();
                        Console.Write("輸入作者: ");
                        string author = Console.ReadLine();
                        Console.Write("是否公開（0: 不公開, 1: 公開）: ");
                        int isPublic = GetUserInputAsInt(0, 1);
                        Console.Write("輸入文字方向（1: 直書, 0: 橫書, 2: 自動偵測）: ");
                        int orientation = GetUserInputAsInt(0, 2);

                        //int bookId = await CreateBookAsync(token, title, author, isPublic, orientation);
                        //Console.WriteLine($"新增藏書成功，Book ID: {bookId}");
                        Console.WriteLine(await CreateBookAsync(token, title, author, isPublic, orientation));
                        break;

                    case "3":
                        if (string.IsNullOrEmpty(token))
                        {
                            Console.Write("Token 不能為空，");
                            Console.WriteLine("請先執行選項1登入並獲取 Token!");
                            break;
                        }

                        Console.Write("輸入影像檔案路徑: ");
                        string filePath = Console.ReadLine();
                        while (!File.Exists(filePath))
                        {
                            Console.Write("檔案不存在，請重新輸入有效的影像檔路徑: ");
                            filePath = Console.ReadLine();
                        }

                        Console.Write("輸入 Book ID: ");
                        int bookId = GetUserInputAsInt(1, int.MaxValue);

                        Console.Write("選擇文字排序方式（TBRL/TBLR/RLTB/LRTB）: ");
                        string blockOrder = Console.ReadLine().ToUpper();
                        while (!(blockOrder == "TBRL" || blockOrder == "TBLR" || blockOrder == "RLTB" || blockOrder == "LRTB"))
                        {
                            Console.Write("請輸入有效的排序方式（TBRL/TBLR/RLTB/LRTB）: ");
                            blockOrder = Console.ReadLine().ToUpper();
                        }

                        //int queueId = await UploadImageAsync(token, filePath, bookId, blockOrder);
                        //Console.WriteLine($"影像上傳成功，Queue ID: {queueId}");
                        Console.WriteLine(await UploadImageAsync(token, filePath, bookId, blockOrder));
                        break;

                    case "4":
                        if (string.IsNullOrEmpty(token))
                        {
                            Console.Write("Token 不能為空，");
                            Console.WriteLine("請先執行選項1登入並獲取 Token!");
                            break;
                        }
                        Console.Write("輸入 Queue ID: ");
                        int queueIdCheck = GetUserInputAsInt(1, int.MaxValue);

                        int guid = await QueryProgressAsync(token, queueIdCheck);
                        Console.WriteLine($"查詢進度完成，Guid: {guid}");
                        break;

                    case "5":
                        if (string.IsNullOrEmpty(token))
                        {
                            Console.Write("Token 不能為空，");
                            Console.WriteLine("請先執行選項1登入並獲取 Token!");
                            break;
                        }
                        Console.Write("輸入 Guid: ");
                        guid = GetUserInputAsInt(1, int.MaxValue);

                        string result = await GetRecognitionResultAsync(token, guid);
                        Console.WriteLine($"辨識結果：{result}");
                        break;

                    case "6":
                        Console.WriteLine("程式結束...");
                        return;

                    default:
                        Console.WriteLine("請輸入有效選項！");
                        break;
                }
            }
        }


        static async Task<string> LoginAsync()
        {
            var config = LoadConfiguration();

            // 從 appsettings.json 讀取帳號與密碼
            string account = Crypt.DESDecrypt(config["ApiSettings:Account"]??"", "prenkin", "0421");
            string password = Crypt.DESDecrypt(config["ApiSettings:Password"] ?? "", "prenkin", "0421");

            if (string.IsNullOrEmpty(account) || string.IsNullOrEmpty(password))
            {
                Console.WriteLine("錯誤：無法讀取帳號或密碼，請確認 appsettings.json 設定");
                return "";
            }
            // 手動設定 User-Agent，模仿 Postman 或常見瀏覽器
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

            var formData = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("account", account),
                new KeyValuePair<string, string>("password", password)
            });

            var response = await client.PostAsync(baseUrl + "auth.php", formData);

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"錯誤：登入失敗，HTTP 狀態碼：{response.StatusCode}");
                return "";
            }

            // 直接讀取 API 回應的 JSON 內容
            var rawResponse = await response.Content.ReadAsStringAsync();

            // **直接印出 API Response Body**
            //Console.WriteLine("Response Body:");
            //Console.WriteLine(rawResponse);

            try
            {
                using JsonDocument doc = JsonDocument.Parse(rawResponse);
                JsonElement root = doc.RootElement;
                if (root.TryGetProperty("status", out JsonElement status))
                    Console.WriteLine($"status: {status.GetInt32()}");
                if (root.TryGetProperty("access_token", out JsonElement token))
                {
                    Console.WriteLine($"Token: {token.GetString()}");
                    return token.GetString();
                }
                if (root.TryGetProperty("message", out JsonElement message))
                    Console.WriteLine($"message: {message.GetString()}");
            }
            catch (System.Text.Json.JsonException)
            {
                Console.WriteLine("錯誤：無法解析登入回應，請確認 API 是否正常回應 JSON。");
            }

            return "";
        }

        static async Task<string> CreateBookAsync(string token, string title, string author, int isPublic, int orientation)
        {
            var formData = new FormUrlEncodedContent(new[]
            {
            new KeyValuePair<string, string>("token", token),
            new KeyValuePair<string, string>("title", title),
            new KeyValuePair<string, string>("author", author),
            new KeyValuePair<string, string>("public", isPublic.ToString()),
            new KeyValuePair<string, string>("orientation", orientation.ToString())
        });

            var response = await client.PostAsync(baseUrl + "create_book.php", formData);
            //return response.IsSuccessStatusCode ? int.Parse(await response.Content.ReadAsStringAsync()) : 0;
            return await response.Content.ReadAsStringAsync();
        }

        static async Task<string> UploadImageAsync(string token, string filePath, int bookId, string blockOrder)
        {
            if (!File.Exists(filePath))
            {
                Console.WriteLine("錯誤：檔案不存在，請確認檔案路徑是否正確。");
                return "0";
            }

            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(token), "token");
            form.Add(new StringContent(bookId.ToString()), "bookid");
            form.Add(new StringContent(blockOrder), "block_order");

            var fileStream = File.OpenRead(filePath);
            var fileContent = new StreamContent(fileStream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(fileContent, "page", Path.GetFileName(filePath));

            var response = await client.PostAsync(baseUrl + "upload.php", form);

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"錯誤：上傳影像失敗，HTTP 狀態碼：{response.StatusCode}");
                return "0";
            }

            var json = await response.Content.ReadAsStringAsync();
            if (json.Contains("queue_id"))
            {
                //return int.Parse(json.Split(':')[1].TrimEnd('}', ' '));
                //return  json  ;
            }
            return json;
            //Console.WriteLine("錯誤：未能取得 queue_id，請確認 API 回應。");
            //return "0";
        }

        static async Task<int> QueryProgressAsync(string token, int queueId)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, baseUrl + "queue.php");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("queue_id", queueId.ToString())
            });

            var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"錯誤：查詢失敗，HTTP 狀態碼：{response.StatusCode}");
                return 0;
            }

            // 讀取 JSON 回應
            var json = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response Body:");
            Console.WriteLine(json);
            try
            {
                // 使用 Newtonsoft.Json 解析 JSON
                JObject parsedJson = JObject.Parse(json);
                // 確保 `status` 為 200
                if (parsedJson["status"]?.ToObject<int>() == 200)
                {
                    // 提取 `guid` 值
                    JArray guidsArray = (JArray)parsedJson["guids"];
                    if (guidsArray?.Count > 0)
                    {
                        int guid = guidsArray[0]["guid"]?.ToObject<int>() ?? 0;
                        //Console.WriteLine($"GUID: {guid}");
                        return guid;
                    }
                }
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                Console.WriteLine($"錯誤：JSON 解析失敗，錯誤訊息：{ex.Message}");
            }

            Console.WriteLine("錯誤：未能取得 GUID，請確認 API 回應格式。");
            return 0;
        }

        static async Task<string> GetRecognitionResultAsync(string token, int guid)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, baseUrl + "query.php");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new FormUrlEncodedContent(new[]
            {
        new KeyValuePair<string, string>("guid", guid.ToString())
    });

            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"錯誤：取得辨識結果失敗，HTTP 狀態碼：{response.StatusCode}");
                return "辨識失敗";
            }

            var json = await response.Content.ReadAsStringAsync();
            if (json.Contains("\"result\""))
            {
                return json.Split("\"result\":")[1].TrimEnd('}', ' ').Replace("\"", "");
            }

            Console.WriteLine("錯誤：未能取得辨識結果，請確認 API 回應。");
            return "辨識失敗";
        }


        static int GetUserInputAsInt(int min, int max)
        {
            int value;
            while (!int.TryParse(Console.ReadLine(), out value) || value < min || value > max)
            {
                Console.Write($"請輸入有效數字 ({min} - {max}): ");
            }
            return value;
        }

        static IConfiguration LoadConfiguration()
        {
            var config = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory()) // 設定基礎路徑
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true) // 讀取 JSON 設定
                .Build();
            return config;
        }
    }
}