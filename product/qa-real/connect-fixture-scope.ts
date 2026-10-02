// QA inspection boundary only. Never import this into the shared product function.
type Client = { from: (table: string) => any; auth: any; storage: any };
export function fixtureAllowed(actor: string, allowed: readonly string[]) { return allowed.includes(actor); }
export async function fixtureClient(client: Client, allowed: readonly string[]): Promise<Client> {
  if (allowed.length !== 2 || new Set(allowed).size !== 2) throw new Error('QA_SCOPE_CONFIGURATION');
  const member = (id: unknown) => typeof id === 'string' && allowed.includes(id);
  const { data, error } = await client.from('doit_matches').select('id').in('user_a', [...allowed]).in('user_b', [...allowed]);
  if (error) throw new Error('QA_SCOPE_CONNECTION_READ');
  const connections = (data ?? []).map((r: { id: string }) => r.id);
  const fields: Record<string, string[]> = {
    profiles: ['id'], profile_photos: ['user_id'], doit_insights: ['user_id'], doit_records: ['user_id'],
    doit_matches: ['user_a','user_b'], doit_match_candidates: ['user_a','user_b'],
    doit_match_answers: ['user_id'], doit_match_messages: ['sender_id'], doit_match_outcomes: ['user_id'],
    doit_request_events: ['user_id'], blocks: ['blocker_id','blocked_user_id'], user_reports: ['reporter_id','target_user_id'],
  };
  const connectionTables = new Set(['doit_match_answers','doit_match_messages','doit_match_outcomes']);
  const scope = (table: string, q: any) => {
    if (!fields[table]) throw new Error('QA_SCOPE_TABLE');
    for (const column of fields[table]) q=q.in(column,[...allowed]);
    if (connectionTables.has(table)) q=q.in('match_id',connections);
    return q;
  };
  const validate = (table: string, rows: unknown, partial=false) => {
    if (!fields[table]) throw new Error('QA_SCOPE_TABLE');
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      if (!row || typeof row !== 'object') throw new Error('QA_SCOPE_WRITE');
      for (const key of fields[table]) if ((!partial || key in row) && !member(row[key])) throw new Error('QA_SCOPE_WRITE');
      if (connectionTables.has(table) && (!partial || 'match_id' in row) && !connections.includes(row.match_id)) throw new Error('QA_SCOPE_WRITE');
      if (table==='doit_request_events' && (!partial || 'target_id' in row) && !connections.includes(row.target_id)) throw new Error('QA_SCOPE_WRITE');
      if (table==='profile_photos' && 'storage_path' in row && !member(String(row.storage_path).split('/')[0])) throw new Error('QA_SCOPE_ASSET');
    }
  };
  return {
    from(table: string) {
      if (!fields[table]) throw new Error('QA_SCOPE_TABLE');
      const q=client.from(table);
      return {
        select: (...args: any[]) => scope(table,q.select(...args)),
        update: (row: unknown) => { validate(table,row,true); return scope(table,q.update(row)); },
        insert: (rows: unknown) => { validate(table,rows); return q.insert(rows); },
        upsert: (rows: unknown, options: unknown) => { validate(table,rows); return q.upsert(rows,options); },
      };
    },
    auth: { admin: { async listUsers({page=1}: {page?:number}) {
      if(page!==1)return {data:{users:[]},error:null};
      const users=[];
      for(const id of allowed){const r=await client.auth.admin.getUserById(id);if(r.error)return {data:null,error:r.error};if(r.data?.user)users.push(r.data.user);}
      return {data:{users},error:null};
    } } },
    storage: { from(bucket: string) { if(bucket!=='profile-photos')throw new Error('QA_SCOPE_ASSET');return {
      createSignedUrl(path: string, seconds: number) {
        if(!member(path.split('/')[0]) || path.includes('..'))throw new Error('QA_SCOPE_ASSET');
        return client.storage.from(bucket).createSignedUrl(path,seconds);
      },
    }; } },
  };
}
