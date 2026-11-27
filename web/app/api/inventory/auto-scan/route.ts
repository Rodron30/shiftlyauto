import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile, createSupabaseServerClient } from '@/lib/supabaseServer';
import { detectProvider } from '@/lib/integrations/provider-detection';
import { TriCityAdapter } from '@/lib/integrations/adapters/tricity-adapter';
import { validateScrapeUrl } from '@/lib/scraper/url-security';

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile || !profile.dealership_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { url, integrationId } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    await validateScrapeUrl(url);

    const providerInfo = detectProvider(url);

    if (!providerInfo) {
      return NextResponse.json(
        {
          error: 'Unsupported provider',
          message: 'This provider is not currently supported. Please contact support for assistance.',
        },
        { status: 400 },
      );
    }

    if (providerInfo.supported === false) {
      return NextResponse.json(
        {
          error: 'Unsupported provider',
          message: `${providerInfo.name} is not currently supported.`,
        },
        { status: 400 },
      );
    }

    if (providerInfo.name === 'Tri-City Mitsubishi') {
      if (!integrationId || typeof integrationId !== 'string') {
        return NextResponse.json(
          { error: 'Integration ID is required for Tri-City scanning' },
          { status: 400 },
        );
      }

      const supabase = await createSupabaseServerClient();
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('*')
        .eq('id', integrationId)
        .eq('dealership_id', profile.dealership_id)
        .eq('integration_type', 'INVENTORY')
        .eq('provider', 'tricity_mitsubishi')
        .single();

      if (integrationError || !integration) {
        return NextResponse.json(
          { error: 'Integration not found or not authorized' },
          { status: 404 },
        );
      }

      const feedUrl = integration.config?.feed_url;
      if (!feedUrl || typeof feedUrl !== 'string') {
        return NextResponse.json(
          { error: 'Tri-City integration requires a configured feed URL' },
          { status: 400 },
        );
      }

      const adapter = new TriCityAdapter();
      const result = await adapter.scanServerSide({
        integrationId,
        dealershipId: profile.dealership_id,
        feedUrl,
        pageSize: integration.config?.page_size || 20,
        maxVehicles: integration.config?.max_vehicles || 500,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Scan failed' },
          { status: 500 },
        );
      }

      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        error: 'Provider not configured for auto-scan',
        message: `${providerInfo.name} requires browser extension scanning. Please install the Dealerarch extension and try again.`,
        provider: providerInfo,
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Auto-scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
