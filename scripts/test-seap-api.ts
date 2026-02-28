/**
 * Test direct SEAP API
 */

const SEAP_API = 'https://e-licitatie.ro/api-pub/NoticeCommon/GetCANoticeList';

async function testSeapApi() {
  console.log('Testing SEAP API...\n');

  try {
    const response = await fetch(SEAP_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://e-licitatie.ro/',
        'Origin': 'https://e-licitatie.ro',
      },
      body: JSON.stringify({
        cpvCodeId: '72000000-5', // IT services - format complet
        pageSize: 10,
        pageIndex: 0,
        sysNoticeState: { id: 2 }, // 2 = Publicat
      }),
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const text = await response.text();
    console.log('\nResponse (first 1000 chars):');
    console.log(text.substring(0, 1000));

    if (response.ok) {
      try {
        const data = JSON.parse(text);
        console.log('\n=== Parsed Data ===');
        console.log('Total items:', data.items?.length || data.searchResult?.items?.length || 0);

        const items = data.items || data.searchResult?.items || [];
        if (items.length > 0) {
          console.log('\nFirst tender:');
          console.log(JSON.stringify(items[0], null, 2));
        }
      } catch (e) {
        console.log('Could not parse JSON:', e);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSeapApi();
