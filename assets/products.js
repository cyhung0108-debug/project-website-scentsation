const productsScriptUrl = document.currentScript?.src || new URL("assets/products.js", window.location.href).href;
const defaultSecondProductImage = new URL("images/2nd.png", productsScriptUrl).href;
const defaultPromotionNotice = "購買滿 HK$3,000.00 可享免費送貨。";
const defaultPointsNotice = "會員購買此商品可儲積分，積分可於下次購物使用。";
window.ONLINE_SHOP_DEFAULT_SECOND_IMAGE = defaultSecondProductImage;

window.ONLINE_SHOP_PRODUCTS = [
  {
    "id": "charcoal-3-wick-candle",
    "showOnHome": true,
    "name": "炭黑三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/Resize_20v1-AP03-CH-Charcoal-Hero_1024x1024.jpg?v=1759853465",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/Charcoal-3-Wick-Lifestyle-1_1024x1024.jpg?v=1760112470"
    ],
    "description": [
      "以雪松、檀香與煙燻琥珀堆疊出深邃香氣，適合客廳、玄關與需要安定氛圍的空間。",
      "燃燒時間：約 80 小時",
      "香調：木質、煙燻、琥珀",
      "容量：三芯大容量玻璃杯",
      "商戶可於 assets/products.js 修改此內容。"
    ]
  },
  {
    "id": "rouge-3-wick-candle",
    "showOnHome": false,
    "name": "柔格三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-CR-Rouge-Hero_web_1024x1024.jpg?v=1760112480",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/CH_20Rouge_203-Wick-Lifestyle-1_1024x1024.jpg?v=1760112481"
    ],
    "description": [
      "溫暖辛香與木質底蘊交織，帶有更柔和的晚間氣息。",
      "燃燒時間：約 80 小時",
      "香調：木質、辛香、溫暖",
      "適合：客廳、臥室、書房"
    ]
  },
  {
    "id": "earl-grey-bitters-3-wick-candle",
    "showOnHome": true,
    "name": "伯爵苦橙三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "柑橘調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-EG-Earl_20Grey_20Bitters-Hero_web_1024x1024.jpg?v=1760112395",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-EG-Earl_20Grey_20Bitters-Hero_web_1024x1024.jpg?v=1760112395"
    ],
    "description": [
      "清亮柑橘與茶香交錯，帶來乾淨、明亮又有層次的香氛感。",
      "燃燒時間：約 80 小時",
      "香調：柑橘、茶香、微苦橙皮",
      "適合：餐廳、工作區"
    ]
  },
  {
    "id": "santal-rock-rose-3-wick-candle",
    "showOnHome": false,
    "name": "檀香岩玫瑰三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "花香調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-SR-Santal_20Rock_20Rose-Hero_web_1024x1024.jpg?v=1760112391",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-SR-Santal_20Rock_20Rose-Hero_web_1024x1024.jpg?v=1760112391"
    ],
    "description": [
      "檀香的溫潤結合岩玫瑰的柔美，營造優雅而不甜膩的居家香氣。",
      "燃燒時間：約 80 小時",
      "香調：檀香、玫瑰、柔和木質",
      "適合：臥室、浴室"
    ]
  },
  {
    "id": "wild-mint-and-ivy-3-wick-candle",
    "showOnHome": true,
    "name": "野薄荷常春藤三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "綠意調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-WM-Wild_20Mint_20and_20Ivy-Hero_web_1024x1024.jpg?v=1760112424",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-WM-Wild_20Mint_20and_20Ivy-Hero_web_1024x1024.jpg?v=1760112424"
    ],
    "description": [
      "清新的薄荷與綠葉氣息，讓空間像剛打開窗一樣明亮。",
      "燃燒時間：約 80 小時",
      "香調：薄荷、常春藤、綠葉",
      "適合：廚房、工作區"
    ]
  },
  {
    "id": "canvas-3-wick-candle",
    "showOnHome": true,
    "name": "畫布三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "花香調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-CA-Canvas-Hero_web_1024x1024.jpg?v=1760112356",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-CA-Canvas-Hero_web_1024x1024.jpg?v=1760112356"
    ],
    "description": [
      "乾淨柔和的白花與麝香調，像剛洗好的棉布般安靜舒適。",
      "燃燒時間：約 80 小時",
      "香調：白花、麝香、乾淨皂感",
      "適合：臥室、衣帽間"
    ]
  },
  {
    "id": "white-vetiver-3-wick-candle",
    "showOnHome": false,
    "name": "白色岩蘭草三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-WV-White_20Vetiver-Hero_web_1024x1024.jpg?v=1760112354",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-WV-White_20Vetiver-Hero_web_1024x1024.jpg?v=1760112354"
    ],
    "description": [
      "岩蘭草與乾淨木質調交織，沉穩但不厚重。",
      "燃燒時間：約 80 小時",
      "香調：岩蘭草、木質、清新",
      "適合：書房、玄關"
    ]
  },
  {
    "id": "hinoki-lavender-3-wick-candle",
    "showOnHome": false,
    "name": "檜木薰衣草三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "草本調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-HL-Hinoki_20Lavender-Hero_web_1024x1024.jpg?v=1760112350",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-HL-Hinoki_20Lavender-Hero_web_1024x1024.jpg?v=1760112350"
    ],
    "description": [
      "檜木與薰衣草帶出靜謐草本氣息，適合放鬆與睡前儀式。",
      "燃燒時間：約 80 小時",
      "香調：檜木、薰衣草、草本",
      "適合：臥室、浴室"
    ]
  },
  {
    "id": "sea-salt-grapefruit-3-wick-candle",
    "showOnHome": true,
    "name": "海鹽葡萄柚三芯香氛蠟燭",
    "price": 2680,
    "category": ["三芯蠟燭", "柑橘果香調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP03-SG-Sea_20Salt_20Grapefruit-Hero_web_1024x1024.jpg?v=1760112346",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP03-SG-Sea_20Salt_20Grapefruit-Hero_web_1024x1024.jpg?v=1760112346"
    ],
    "description": [
      "海鹽的清爽感搭配葡萄柚果香，讓空間更輕盈明亮。",
      "燃燒時間：約 80 小時",
      "香調：葡萄柚、海鹽、柑橘",
      "適合：客廳、餐廳"
    ]
  },
  {
    "id": "charcoal-reed-diffuser",
    "showOnHome": true,
    "name": "炭黑擴香瓶",
    "price": 1880,
    "category": ["擴香瓶", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/Resize_20v1-AP04-CH-Charcoal-Hero_1024x1024.jpg?v=1759853458",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/Resize_20v1-AP04-CH-Charcoal-Hero_1024x1024.jpg?v=1759853458"
    ],
    "description": [
      "不用點火也能持續釋放炭黑香氣，適合長時間維持空間氣味。",
      "容量：約 207 ml",
      "香調：木質、煙燻、琥珀",
      "使用方式：依空間大小調整擴香枝數量"
    ]
  },
  {
    "id": "hinoki-lavender-classic-candle",
    "showOnHome": true,
    "name": "檜木薰衣草經典香氛蠟燭",
    "price": 1480,
    "category": ["經典蠟燭", "草本調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP01-HL-Hinoki_20Lavender-Hero_web_1024x1024.jpg?v=1760113537",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/AP01-HL-Hinoki_20Lavender-Hero_web_1024x1024.jpg?v=1760113537"
    ],
    "description": [
      "小巧但香氣完整的經典尺寸，適合日常單點使用。",
      "燃燒時間：約 50 小時",
      "香調：檜木、薰衣草、草本",
      "適合：床邊、書桌"
    ]
  },
  {
    "id": "charcoal-room-spray",
    "showOnHome": false,
    "name": "炭黑室內香氛噴霧",
    "price": 1380,
    "category": ["室內噴霧", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/Resize_20v1-AP24-CH-Charcoal-Hero_1024x1024.jpg?v=1780517262",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/Resize_20v1-AP24-CH-Charcoal-Hero_1024x1024.jpg?v=1780517262"
    ],
    "description": [
      "快速為空間補上炭黑香氣，適合出門前、迎客前或日常整理後使用。",
      "容量：約 100 ml",
      "香調：木質、煙燻、琥珀",
      "使用方式：向空氣中輕噴 2 至 3 下"
    ]
  },
  {
    "id": "charcoal-mini-tin-candle",
    "showOnHome": true,
    "name": "炭黑迷你罐裝香氛蠟燭",
    "price": 420,
    "category": ["迷你罐裝蠟燭", "木質調"],
    "images": [
      "https://apothekeco.com/cdn/shop/files/AP10-CH-Charcoal-Hero_web_20_1_1024x1024.jpg?v=1760122622",
      defaultSecondProductImage,
      "https://apothekeco.com/cdn/shop/files/Charcoal-Mini-Tin-Candle-Lifestyle-2_d1ddc03a-037d-48cb-93be-fa37106889b9_1024x1024.jpg?v=1760122622"
    ],
    "description": [
      "迷你尺寸方便試香與攜帶，適合小空間、旅行或作為禮物加購。",
      "燃燒時間：約 15 小時",
      "淨重：2 oz / 56 g",
      "尺寸：直徑約 2.5 吋，高約 1.75 吋",
      "香調：木質、煙燻、楓糖、覆盆子"
    ]
  }
];

// 商戶可在個別商品加入 promotionNotice 或 pointsNotice 覆寫以下預設內容；設為空字串即可隱藏。
window.ONLINE_SHOP_PRODUCTS.forEach((product) => {
  product.promotionNotice = product.promotionNotice ?? defaultPromotionNotice;
  product.pointsNotice = product.pointsNotice ?? defaultPointsNotice;
});
