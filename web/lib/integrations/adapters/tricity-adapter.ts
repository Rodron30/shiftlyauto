import { VehiclePreview, ScanResult } from '../vehicle-types';
import { createScanRecord } from '../scan-records';
import { fetchAllTriCityInventory, type TriCityCollectedInventory } from '@/lib/scraper/tricity-inventory-fetcher';
import { TriCityHttpFeedTransport } from '@/lib/scraper/tricity-http-feed';
import { validateScrapeUrl } from '@/lib/scraper/url-security';

export class TriCityAdapter {
  name = 'Tri-City Mitsubishi';

  canHandle(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === 'tricitymits.com' || hostname === 'www.tricitymits.com';
    } catch {
      return false;
    }
  }

  async scanServerSide(config: {
    integrationId: string;
    dealershipId: string;
    feedUrl: string;
    pageSize: number;
    maxVehicles: number;
  }): Promise<ScanResult> {
    try {
      await validateScrapeUrl(config.feedUrl);

      const buildEndpoint = (page: number, size: number) => {
        let url: URL;
        try {
          url = new URL(config.feedUrl);
        } catch {
          throw new Error('Configured Tri-City feed URL is invalid.');
        }

        const host = url.hostname.toLowerCase();
        const allowed =
          host === 'vms.prod.convertus.rocks' ||
          host === 'tricitymits.com' ||
          host.endsWith('.tricitymits.com');

        if (url.protocol !== 'https:' || !allowed || url.username || url.password) {
          throw new Error('Feed URL must use HTTPS and an approved Tri-City or Convertus host.');
        }

        if (url.href.includes('{page}') || url.href.includes('{pageSize}')) {
          return url.href
            .replaceAll('{page}', String(page))
            .replaceAll('{pageSize}', String(size));
        }

        if (
          host === 'vms.prod.convertus.rocks' &&
          url.pathname.replace(/\/+$/, '') === '/api/filtering'
        ) {
          const params = new URLSearchParams({
            cp: '1868', ln: 'en', pg: String(page), pc: String(size),
            dc: 'true', qs: '', im: 'true', svs: '', sc: 'used', v1: '',
            st: '', ai: 'true', oem: 'Mitsubishi', dp: '',
            in_transit: 'true', in_stock: 'true', on_order: 'true',
            sn: '', mk: 'inventory', view: 'grid', defaultParams: '',
            pnpi: 'reta', pnpm: 'inte', pnpf: 'inte',
            pupi: 'reta', pupm: 'none', pupf: 'inte',
            nnpi: 'inte', nnpm: 'inte', nnpf: 'inte',
            nupi: 'none', nupm: 'none', nupf: 'inte', po: 'fixed',
          });

          const endpoint = `${url.origin}${url.pathname}?${params.toString()}`;
          const proxy = new URL(
            'https://www.tricitymits.com/wp-content/plugins/convertus-vms/include/php/ajax-vehicles.php',
          );
          proxy.searchParams.set('endpoint', endpoint);
          proxy.searchParams.set('action', 'vms_data');
          return proxy.toString();
        }

        url.searchParams.set('pg', String(page));
        url.searchParams.set('pc', String(size));
        return url.toString();
      };

      const collected = await fetchAllTriCityInventory(
        buildEndpoint,
        config.pageSize,
        config.maxVehicles,
        new TriCityHttpFeedTransport(),
      );

      const vehicles: VehiclePreview[] = collected.results.map((item: unknown) => {
        if (!item || typeof item !== 'object') return null;
        const v = item as Record<string, unknown>;
        const vin = typeof v.vin === 'string' ? v.vin.trim().toUpperCase() : '';
        if (!vin) return null;

        const stringValue = (x: unknown) =>
          typeof x === 'string' && x.trim() ? x.trim() : null;

        const numberValue = (x: unknown) => {
          if (typeof x === 'number' && Number.isFinite(x)) return x;
          if (typeof x === 'string') {
            const normalized = x.trim().replace(/,/g, '');
            if (!/^\d+$/.test(normalized)) return null;
            const n = Number(normalized);
            return Number.isSafeInteger(n) && n >= 0 ? n : null;
          }
          return null;
        };

        const priceValue = (x: unknown) => {
          if (typeof x === 'number' && Number.isFinite(x)) return x > 0 ? x : null;
          if (typeof x === 'string') {
            const normalized = x.trim().replace(/[$,\s]/g, '');
            if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
            const n = Number(normalized);
            return Number.isFinite(n) && n > 0 ? n : null;
          }
          return null;
        };

        const price = priceValue(v.final_price) ??
          priceValue(v.internet_price) ??
          priceValue(v.sale_price) ??
          priceValue(v.asking_price);

        return {
          vin,
          year: numberValue(v.year),
          make: stringValue(v.make),
          model: stringValue(v.model),
          trim: stringValue(v.trim),
          stockNumber: stringValue(v.stock_number),
          price: price && price > 0 ? price : null,
          mileage: numberValue(v.odometer),
          sourceUrl: stringValue(v.vdp_url),
          images: Array.isArray(v.images)
            ? v.images.filter((x): x is string =>
                typeof x === 'string' && /^https:\/\//i.test(x),
              ).slice(0, 10)
            : [],
        };
      }).filter((v): v is VehiclePreview => v !== null);

      const scanId = await createScanRecord({
        provider: 'tricity_mitsubishi',
        sourceUrl: config.feedUrl,
        integrationId: config.integrationId,
        scanMethod: 'feed',
        vehicles,
        complete: collected.complete,
        allPagesLoaded: collected.complete && collected.pagesFetched > 0,
        pagesFetched: collected.pagesFetched,
        totalPages: collected.totalPages,
      });

      if (!scanId) {
        return {
          success: true,
          complete: collected.complete,
          vehicles,
          totalVehicles: collected.totalVehicles || vehicles.length,
          pagesFetched: collected.pagesFetched,
          tableMissing: true,
          error: 'Required database migration has not been applied. Please contact your administrator to enable imports.',
        };
      }

      return {
        success: true,
        complete: collected.complete,
        vehicles,
        totalVehicles: collected.totalVehicles || vehicles.length,
        pagesFetched: collected.pagesFetched,
        totalPages: collected.totalPages || collected.pagesFetched,
        scanId,
      };
    } catch (error) {
      return {
        success: false,
        complete: false,
        vehicles: [],
        totalVehicles: 0,
        pagesFetched: 0,
        error: error instanceof Error ? error.message : 'Tri-City scan failed',
      };
    }
  }
}
