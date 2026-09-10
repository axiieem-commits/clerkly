const { createClient } = require("@supabase/supabase-js");

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
  }
  return { url, publishableKey };
}

function clientOptions(accessToken) {
  return {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {})
  };
}

function createPublicClient() {
  const { url, publishableKey } = supabaseConfig();
  return createClient(url, publishableKey, clientOptions());
}

function createUserClient(accessToken) {
  const { url, publishableKey } = supabaseConfig();
  return createClient(url, publishableKey, clientOptions(accessToken));
}

module.exports = { createPublicClient, createUserClient, supabaseConfig };
