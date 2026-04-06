import { supabase } from '../lib/supabase';

export type DriverSigningAssetType = 'seal' | 'signature';

export async function getDefaultDriverSigningAsset(
  ownerId: string,
  assetType: DriverSigningAssetType,
): Promise<{ dataUri: string | null; error: string | null }> {
  try {
    let query = supabase
      .from('seals')
      .select('seal_data_uri, seal_image_url')
      .eq('owner_type', 'driver')
      .eq('owner_id', ownerId)
      .eq('is_default', true)
      .limit(1);

    if (assetType === 'signature') {
      query = query.eq('category', 'signature');
    } else {
      query = query.neq('category', 'signature');
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw error;
    }

    return {
      dataUri: data?.seal_data_uri || data?.seal_image_url || null,
      error: null,
    };
  } catch (err) {
    return {
      dataUri: null,
      error: err instanceof Error ? err.message : '저장된 도장/서명을 불러오지 못했습니다.',
    };
  }
}
