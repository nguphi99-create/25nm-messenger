const express = require('express');
const app = express();
// Privacy Policy Page for Meta App Review
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Chính Sách Bảo Mật - 25 Nm</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: auto; line-height: 1.6; color: #333; }
        h1 { color: #d97706; }
      </style>
    </head>
    <body>
      <h1>Chính Sách Bảo Mật Thông Tin - 25 Nm</h1>
      <p><em>Cập nhật lần cuối: Tháng 7, 2026</em></p>
      
      <p>Tại 25 Nm, chúng tôi tôn trọng sự riêng tư của khách hàng. Chính sách bảo mật này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn thông qua Facebook Messenger Chatbot.</p>
      
      <h2>1. Thông tin chúng tôi thu thập</h2>
      <p>Chúng tôi chỉ thu thập các thông tin mà bạn tự nguyện cung cấp trong quá trình nhắn tin với chatbot, bao gồm: thông tin xe (hãng xe, dòng xe, năm sản xuất), số điện thoại, địa chỉ nhận dịch vụ và thời gian đặt lịch kiểm tra/bảo dưỡng.</p>
      
      <h2>2. Mục đích sử dụng thông tin</h2>
      <p>Thông tin thu thập được chỉ sử dụng cho các mục đích:</p>
      <ul>
        <li>Tư vấn và báo giá gói dịch vụ bảo dưỡng phù hợp cho xe của bạn.</li>
        <li>Sắp xếp kỹ thuật viên đến kiểm tra và bảo dưỡng xe tận nhà tại khu vực Phú Mỹ Hưng, Quận 7.</li>
        <li>Liên hệ xác nhận lịch hẹn dịch vụ.</li>
      </ul>
      
      <h2>3. Bảo mật và Chia sẻ dữ liệu</h2>
      <p>Chúng tôi cam kết không bán, chia sẻ hoặc tiết lộ thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại.</p>
      
      <h2>4. Quyền yêu cầu xóa dữ liệu</h2>
      <p>Nếu bạn muốn xóa toàn bộ lịch sử tư vấn hoặc thông tin cá nhân đã lưu trữ, vui lòng nhắn tin trực tiếp với trang hoặc liên hệ hotline: <strong>0353 123 224</strong>.</p>
    </body>
    </html>
  `);
});
// Serve static images from the 'public' folder
app.use('/public', express.static('public'));
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_custom_secret_token';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Detect public URL from environment variables or default to Render URL
const SERVER_URL = process.env.SERVER_URL || process.env.REPL_URL || "https://25nm-messenger.onrender.com"; 

const IMAGES = {
  menu: `${SERVER_URL}/public/menu.png`,
  goi1: `${SERVER_URL}/public/goi1.png`,
  goi2: `${SERVER_URL}/public/goi2.png`,
  goi3: `${SERVER_URL}/public/goi3.png`
};

// In-memory state to track user conversation flow
const userState = {};

// Webhook Verification Endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// Incoming Message / Event Webhook Endpoint
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    body.entry.forEach((entry) => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// --- ROUTING LOGIC ---

async function handleMessage(senderPsid, receivedMessage) {
  const text = receivedMessage.text ? receivedMessage.text.trim() : '';

  // Handle Quick Replies
  if (receivedMessage.quick_reply) {
    const payload = receivedMessage.quick_reply.payload;
    if (payload === 'MAIN_MENU') return sendMainMenu(senderPsid);
    
    // Handle Option 2 bundle selection
    if (['CHON_GOI_1', 'CHON_GOI_2', 'CHON_GOI_3'].includes(payload) && userState[senderPsid] === 'AWAITING_BUNDLE_CHOICE') {
      delete userState[senderPsid];
      await sendTextWithMenuReturn(senderPsid, "Em đã nhận thông tin, anh chị đợi chút để em tính bảng giá tham khảo cho mình nha.");
      return;
    }
  }

  // Handle conversational flow states (e.g. Car Info)
  if (userState[senderPsid] === 'AWAITING_CAR_INFO') {
    userState[senderPsid] = 'AWAITING_BUNDLE_CHOICE';
    await sendImage(senderPsid, IMAGES.menu);
    await sendQuickReplies(senderPsid, "Anh/chị muốn chọn gói nào ạ?", [
      { title: "Gói 1 - 10.000km", payload: "CHON_GOI_1" },
      { title: "Gói 2 - 20.000km", payload: "CHON_GOI_2" },
      { title: "Gói 3 - 40.000km", payload: "CHON_GOI_3" }
    ]);
    return;
  }

  // Default greeting / catch-all
  sendMainMenu(senderPsid);
}

async function handlePostback(senderPsid, postback) {
  const payload = postback.payload;
  
  delete userState[senderPsid];

  switch (payload) {
    case 'MAIN_MENU':
      sendMainMenu(senderPsid);
      break;

    // OPTION 1: Menu dịch vụ
    case 'MENU_BAO_DUONG':
      await sendText(senderPsid, "Đây là các gói dịch vụ bảo dưỡng bên em");
      await sendImage(senderPsid, IMAGES.menu);
      await sendButtons(senderPsid, "Anh/chị muốn xem chi tiết gói nào ạ?", [
        { title: "Gói 1 - 10.000km", payload: "XEM_GOI_1" },
        { title: "Gói 2 - 20.000km", payload: "XEM_GOI_2" },
        { title: "Gói 3 - 40.000km", payload: "XEM_GOI_3" }
      ]);
      break;

    case 'XEM_GOI_1':
      await sendImage(senderPsid, IMAGES.goi1);
      await sendMenuReturn(senderPsid);
      break;
    case 'XEM_GOI_2':
      await sendImage(senderPsid, IMAGES.goi2);
      await sendMenuReturn(senderPsid);
      break;
    case 'XEM_GOI_3':
      await sendImage(senderPsid, IMAGES.goi3);
      await sendMenuReturn(senderPsid);
      break;

    // OPTION 2: Tính giá chi tiết
    case 'TINH_GIA':
      userState[senderPsid] = 'AWAITING_CAR_INFO';
      await sendText(senderPsid, "Anh/chị vui lòng cho em xin thông tin: Hãng xe, dòng xe và năm sản xuất nhé.");
      break;

    // OPTION 3: Quy trình
    case 'QUY_TRINH':
      await sendText(senderPsid, "Chúng em thực hiện kiểm tra và bảo dưỡng xe ô tô tại nhà khu vực Phú Mỹ Hưng Quận 7, từ 9:00 - 21:00 T2- T6 hàng tuần.");
      await sendButtons(senderPsid, "Anh/chị muốn sử dụng dịch vụ nào ạ?", [
        { title: "Kiểm tra ô tô", payload: "KIEM_TRA" },
        { title: "Bảo dưỡng ô tô", payload: "BAO_DUONG" }
      ]);
      break;

    case 'KIEM_TRA':
      await sendText(senderPsid, "Chúng em đang có dịch vụ kiểm tra ô tô miễn phí cho các anh chị khu vực PMH Quận 7, thời gian kiểm tra sẽ từ 15-30 phút bao gồm hệ thống điện, phanh; tình trạng các chất lỏng trên xe, tình trạng lốp, và kiểm tra tình trạng gầm khi có tiếng động lạ.");
      await sendButtons(senderPsid, "Đăng ký dịch vụ:", [
        { title: "Đăng ký ngay", payload: "DANG_KY" }
      ]);
      break;

    case 'DANG_KY':
      await sendTextWithMenuReturn(senderPsid, "Dạ anh chị cho em xin sdt, địa chỉ và thời gian mình muốn thực hiện kiểm tra ạ");
      break;

    case 'BAO_DUONG':
      await sendText(senderPsid, "Tùy vào đời xe và gói bảo dưỡng mà dịch vụ của chúng em sẽ kéo dài từ 1-4 tiếng. Để đặt lịch, các anh chị chỉ cần chọn ngày giờ mà mình muốn bảo dưỡng xe. Bên em sẽ sắp xếp xe đồ nghề đến nơi và thực hiện bảo dưỡng cho các anh chị. Mình có thể tham khảo menu dịch vụ bên em tại đây.");
      await handlePostback(senderPsid, { payload: 'MENU_BAO_DUONG' });
      break;
  }
}

// --- HELPER SENDING FUNCTIONS ---

async function sendMainMenu(senderPsid) {
  await sendButtons(senderPsid, "25 Nm xin chào anh chị, không biết em có thể hỗ trợ được gì cho mình ạ?", [
    { title: "Menu dịch vụ", payload: "MENU_BAO_DUONG" },
    { title: "Tính giá chi tiết", payload: "TINH_GIA" },
    { title: "Quy trình", payload: "QUY_TRINH" }
  ]);
}

async function sendMenuReturn(senderPsid) {
  await sendQuickReplies(senderPsid, "Anh/chị cần hỗ trợ thêm gì không ạ?", [
    { title: "🔄 Quay lại Menu", payload: "MAIN_MENU" }
  ]);
}

async function sendTextWithMenuReturn(senderPsid, text) {
  await sendQuickReplies(senderPsid, text, [
    { title: "🔄 Quay lại Menu", payload: "MAIN_MENU" }
  ]);
}

async function sendText(senderPsid, text) {
  await callSendAPI(senderPsid, { text });
}

async function sendImage(senderPsid, imageUrl) {
  await callSendAPI(senderPsid, {
    attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } }
  });
}

async function sendButtons(senderPsid, text, buttons) {
  const formattedButtons = buttons.map(btn => ({ type: "postback", title: btn.title, payload: btn.payload }));
  await callSendAPI(senderPsid, {
    attachment: { type: "template", payload: { template_type: "button", text: text, buttons: formattedButtons } }
  });
}

async function sendQuickReplies(senderPsid, text, options) {
  const quickReplies = options.map(opt => ({ content_type: "text", title: opt.title, payload: opt.payload }));
  await callSendAPI(senderPsid, { text: text, quick_replies: quickReplies });
}

async function callSendAPI(senderPsid, response) {
  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderPsid }, message: response })
    });
  } catch (err) {
    console.error('Error sending message:', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
