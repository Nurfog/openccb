const { Client } = require('pg');

async function testQuery() {
    const client = new Client({
        connectionString: "postgresql://user:password@localhost:5432/openccb_lms"
    });

    const orgId = '8555931d-b335-4b4e-9f51-4a0434e591b6';
    const userId = 'ec2e2a38-a1d1-41b2-8202-c9b90d1d5db5';

    try {
        await client.connect();

        const query = `
      SELECT DISTINCT c.* FROM courses c 
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.user_id = $2
      WHERE c.organization_id = $1 OR c.organization_id = '00000000-0000-0000-0000-000000000001' OR e.id IS NOT NULL
    `;

        const res = await client.query(query, [orgId, userId]);
        console.log("Catalog Query Result (Courses found):", res.rowCount);
        console.table(res.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

testQuery();
