export default async function handler(req, res) {
    const SCRIPT_URL = process.env.SCRIPT_URL;
    
    if (!SCRIPT_URL) {
        return res.status(500).json({ success: false, message: "Script URL not configured in environment variables." });
    }

    try {
        // Ambil query string jika ada (misal: ?action=getMonthData...)
        const urlParams = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const targetUrl = SCRIPT_URL + urlParams;

        let fetchOptions = {
            method: req.method,
            headers: { 'Content-Type': 'application/json' }
        };

        // Jika method POST, pastikan req.body diteruskan ke Google Apps Script
        if (req.method === 'POST') {
            // Tangani body baik dalam bentuk string maupun object
            const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            fetchOptions.body = bodyData;
        }

        const response = await fetch(targetUrl, fetchOptions);
        const data = await response.json();
        
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Proxy error: " + error.toString() });
    }
}
