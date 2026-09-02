const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');

// 从环境变量获取配置
const APP_ID = process.env.JDY_APP_ID;
const SECRET_KEY = process.env.JDY_SECRET_KEY;
const ENTRY_ID = process.env.JDY_ENTRY_ID;
const API_URL = 'https://api.jiandaoyun.com/api/v1';

// 简道云 Widget ID 与目标字段的映射
const FIELD_MAP = {
    '_widget_1732240494629': '宴会日期',
    '_widget_1732262075235': '门店',
    '_widget_1731906582755': '客户|宴会主题',
    // 注意：请根据你实际表单的 widget ID 补充以下字段
    // '_widget_xxxxx': '宴会厅', 
    // '_widget_yyyyy': '销售负责人',
    // '_widget_zzzzz': '桌数'
};

async function syncData() {
    console.log("开始同步简道云数据...");
    
    // 1. 获取 Access Token
    const tokenRes = await axios.post(`${API_URL}/app/token`, {
        appId: APP_ID,
        secretKey: SECRET_KEY
    });
    const token = tokenRes.data.data.token;

    // 2. 查询全量数据
    const dataRes = await axios.post(`${API_URL}/app/${APP_ID}/entry/${ENTRY_ID}/data_list`, {
        fields: Object.keys(FIELD_MAP),
        limit: 1000,
        page: 1
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    // 3. 转换数据格式
    const formattedList = dataRes.data.data.map(item => {
        let row = {};
        for (const [widgetId, fieldName] of Object.entries(FIELD_MAP)) {
            let val = item[widgetId];
            if (fieldName === '宴会日期' && val) val = val.split('T')[0];
            row[fieldName] = val || null;
        }
        
        // 补充 HTML 需要的固定格式字段（根据你的需求模拟）
        row["档期属性"] = "星好日"; // 这里可以根据日期逻辑动态计算
        row["预定情况"] = `【签单】${row['宴会厅'] || ''} ${row['宴会类型'] || ''} ${row['宴会时段'] || ''} ${row['客户|宴会主题'] || ''}`;
        row["宴会厅"] = row["宴会厅"] || "未分配";
        row["宴会类型"] = row["宴会类型"] || "婚宴";
        row["宴会时段"] = row["宴会时段"] || "午";
        row["销售负责人"] = row["销售负责人"] || "未知";
        row["桌数"] = row["桌数"] || null;

        return row;
    });

    // 4. 写入 feishu_data.json
    fs.writeFileSync('feishu_data.json', JSON.stringify(formattedList, null, 2));
    console.log(`成功写入 ${formattedList.length} 条数据到 feishu_data.json`);

    // 5. Git 操作
    try {
        execSync('git config user.name "github-actions[bot]"');
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
        execSync('git add feishu_data.json');
        execSync('git commit -m "Auto-sync: Update banquet data from Jiandaoyun"');
        execSync('git push');
        console.log("Git 推送成功！");
    } catch (e) {
        console.log("数据无变动或推送失败", e.message);
    }
}

syncData().catch(err => {
    console.error("同步失败:", err);
    process.exit(1);
});
