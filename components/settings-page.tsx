import React from 'react';
import { Box, Button, CheckBox, H4, Input, Label, Text } from '@adminjs/design-system';

import { DEFAULT_UPLOAD_PATH, SETTINGS_API_PATH } from '../shared.js';
import { SingleImageInput } from './single-image-input.js';

type SettingsMap = Record<string, string>;

const HEX = /^#[0-9a-fA-F]{6}$/;

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box variant="white" boxShadow="card" style={{ borderRadius: 10, padding: 20, marginBottom: 20 }}>
    <H4 style={{ marginTop: 0 }}>{title}</H4>
    {children}
  </Box>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <Box style={{ marginBottom: 16 }}>
    <Label>{label}</Label>
    {children}
    {hint && <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{hint}</Text>}
  </Box>
);

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <Field label={label}>
    <Box style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="color"
        value={HEX.test(value) ? value : '#000000'}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: 44, height: 32, padding: 0, border: '1px solid #e0e2e8', borderRadius: 4 }}
      />
      <Input value={value} onChange={(event) => onChange(event.target.value)} style={{ maxWidth: 140 }} />
    </Box>
  </Field>
);

const SettingsPage: React.FC = () => {
  const [form, setForm] = React.useState<SettingsMap>({});
  const [defaults, setDefaults] = React.useState<SettingsMap>({});
  const [uploadPath, setUploadPath] = React.useState<string>(DEFAULT_UPLOAD_PATH);
  const [library, setLibrary] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const set = (key: string, value: string): void => setForm((current) => ({ ...current, [key]: value }));

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(SETTINGS_API_PATH, { credentials: 'include' });
        const body = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok || body?.forbidden) {
          setForbidden(true);
          return;
        }
        setForm(body.settings ?? {});
        setDefaults(body.defaults ?? {});
        setUploadPath(body.uploadPath ?? DEFAULT_UPLOAD_PATH);
        setLibrary(!!body.library);
      } catch {
        if (alive) setNotice({ type: 'error', text: 'Could not load settings.' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async (): Promise<void> => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(SETTINGS_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ type: 'error', text: body?.error ?? 'Could not save settings.' });
        return;
      }
      setForm(body.settings ?? form);
      setNotice({ type: 'success', text: body?.success ?? 'Settings saved.' });
    } catch {
      setNotice({ type: 'error', text: 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box style={{ padding: 24 }}>Loading…</Box>;
  if (forbidden) return <Box style={{ padding: 24 }}>You do not have access to these settings.</Box>;

  return (
    <Box style={{ padding: 24, maxWidth: 720 }}>
      <H4 style={{ marginTop: 0 }}>Settings</H4>

      {notice && (
        <Box
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            background: notice.type === 'success' ? '#e7f6ec' : '#fdecec',
            color: notice.type === 'success' ? '#1b7f3b' : '#b3261e',
          }}
        >
          {notice.text}
        </Box>
      )}

      <Card title="Branding">
        <Field label="Company name">
          <Input
            value={form['branding.companyName'] ?? ''}
            onChange={(event) => set('branding.companyName', event.target.value)}
          />
        </Field>

        <SingleImageInput
          label="Logo"
          value={form['branding.logo'] ?? ''}
          onChange={(url) => set('branding.logo', url)}
          uploadPath={uploadPath}
          crop={false}
          library={library}
          hint={defaults['branding.logo'] ? `Leave empty to use ${defaults['branding.logo']}.` : 'Leave empty for text only.'}
        />

        <SingleImageInput
          label="Favicon"
          value={form['branding.favicon'] ?? ''}
          onChange={(url) => set('branding.favicon', url)}
          uploadPath={uploadPath}
          crop={false}
          library={library}
          hint="Small square PNG or ICO."
        />

        <ColorField
          label="Primary colour"
          value={form['branding.primaryColor'] ?? ''}
          onChange={(value) => set('branding.primaryColor', value)}
        />
        <ColorField
          label="Accent colour"
          value={form['branding.accentColor'] ?? ''}
          onChange={(value) => set('branding.accentColor', value)}
        />
      </Card>

      <Card title="Uploads">
        <Field label="Storage backend" hint="Where files dropped into upload widgets are stored.">
          <select
            value={form['upload.storage'] ?? 'base64'}
            onChange={(event) => set('upload.storage', event.target.value)}
            style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #e0e2e8' }}
          >
            <option value="base64">Inline base64 (no infrastructure)</option>
            <option value="localDisk">Local disk</option>
          </select>
        </Field>

        <Field label="Max file size (MB)" hint="Between 0.1 and 25.">
          <Input
            type="number"
            min={0.1}
            max={25}
            step={0.1}
            value={form['upload.maxFileSizeMb'] ?? '5'}
            onChange={(event) => set('upload.maxFileSizeMb', event.target.value)}
            style={{ maxWidth: 120 }}
          />
        </Field>

        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckBox
            id="upload.imagesOnly"
            checked={(form['upload.imagesOnly'] ?? 'true') === 'true'}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              set('upload.imagesOnly', event.target.checked ? 'true' : 'false')
            }
          />
          <Label htmlFor="upload.imagesOnly" style={{ margin: 0 }}>
            Accept images only
          </Label>
        </Box>
      </Card>

      <Button variant="primary" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </Box>
  );
};

export default SettingsPage;
