import { Block, Button, Empty, Flexbox, Modal, SearchBar, Skeleton, Tag, Text } from '@lobehub/ui';
import { App, Form, Input, Select, Switch, Table } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { mutate } from 'swr';

import type { AgentPresetUpsertInput } from '@/services/agentPreset';
import { agentPresetService } from '@/services/agentPreset';

const useStyles = createStaticStyles(({ css }) => ({
  container: css`
    width: 100%;
    max-width: 1280px;
    padding: 24px;
  `,
  header: css`
    margin-block-end: 16px;
  `,
  hint: css`
    margin-block-end: 12px;
    padding-block: 12px;
    padding-inline: 16px;
    border-radius: 12px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  toolbar: css`
    margin-block-end: 16px;
  `,
}));

interface FormValues {
  avatar?: string;
  backgroundColor?: string;
  category?: string;
  description?: string;
  featured?: boolean;
  identifier: string;
  model?: string;
  openingMessage?: string;
  openingQuestionsRaw?: string;
  provider?: string;
  status: 'draft' | 'published' | 'archived';
  systemRole?: string;
  tagsRaw?: string;
  title: string;
}

const ADMIN_LIST_KEY = 'agent-presets:admin-list';

const AgentPresetsAdmin = memo(() => {
  const { t } = useTranslation('discover');
  const styles = useStyles();
  const { message, modal } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useSWR(ADMIN_LIST_KEY, () => agentPresetService.adminList());

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((p) =>
      [p.title, p.description, p.identifier, p.category, ...(p.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [data, keyword]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ featured: false, status: 'draft' });
    setOpen(true);
  };

  const openEdit = async (id: string) => {
    setEditingId(id);
    try {
      const detail = await agentPresetService.adminDetail(id);
      const cfg = (detail.config ?? {}) as Record<string, any>;
      form.setFieldsValue({
        avatar: detail.avatar ?? '',
        backgroundColor: detail.backgroundColor ?? '',
        category: detail.category ?? '',
        description: detail.description ?? '',
        featured: detail.featured,
        identifier: detail.identifier,
        model: cfg.model ?? '',
        openingMessage: cfg.openingMessage ?? '',
        openingQuestionsRaw: Array.isArray(cfg.openingQuestions)
          ? cfg.openingQuestions.join('\n')
          : '',
        provider: cfg.provider ?? '',
        status: (detail.status as any) ?? 'draft',
        systemRole: cfg.systemRole ?? '',
        tagsRaw: (detail.tags ?? []).join(', '),
        title: detail.title,
      });
      setOpen(true);
    } catch {
      message.error(t('agentPresets.admin.loadFailed'));
    }
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);

    const tags = (values.tagsRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const openingQuestions = (values.openingQuestionsRaw ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const config: AgentPresetUpsertInput['config'] = {
      avatar: values.avatar || undefined,
      backgroundColor: values.backgroundColor || undefined,
      description: values.description || undefined,
      model: values.model || undefined,
      openingMessage: values.openingMessage || undefined,
      openingQuestions: openingQuestions.length > 0 ? openingQuestions : undefined,
      provider: values.provider || undefined,
      systemRole: values.systemRole || undefined,
      tags: tags.length > 0 ? tags : undefined,
      title: values.title,
    };

    const payload: AgentPresetUpsertInput = {
      avatar: values.avatar || null,
      backgroundColor: values.backgroundColor || null,
      category: values.category || null,
      config,
      description: values.description || null,
      featured: values.featured,
      identifier: values.identifier,
      status: values.status,
      tags,
      title: values.title,
    };

    try {
      if (editingId) {
        await agentPresetService.adminUpdate(editingId, payload);
        message.success(t('agentPresets.admin.updated'));
      } else {
        await agentPresetService.adminCreate(payload);
        message.success(t('agentPresets.admin.created'));
      }
      setOpen(false);
      await mutate(ADMIN_LIST_KEY);
      await mutate('agent-presets:list');
      await mutate('agent-presets:home');
    } catch (e) {
      console.error('[agentPresets:admin]', e);
      message.error(t('agentPresets.admin.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id: string, title: string) => {
    modal.confirm({
      cancelText: t('agentPresets.admin.cancel'),
      okButtonProps: { danger: true },
      okText: t('agentPresets.admin.delete'),
      onOk: async () => {
        try {
          await agentPresetService.adminDelete(id);
          message.success(t('agentPresets.admin.deleted'));
          await mutate(ADMIN_LIST_KEY);
          await mutate('agent-presets:list');
          await mutate('agent-presets:home');
        } catch {
          message.error(t('agentPresets.admin.deleteFailed'));
        }
      },
      title: t('agentPresets.admin.deleteConfirm', { title }),
    });
  };

  const onChangeStatus = async (id: string, status: 'draft' | 'published' | 'archived') => {
    try {
      await agentPresetService.adminSetStatus(id, status);
      await mutate(ADMIN_LIST_KEY);
      await mutate('agent-presets:list');
      await mutate('agent-presets:home');
    } catch {
      message.error(t('agentPresets.admin.statusFailed'));
    }
  };

  return (
    <Flexbox align="center" height="100%" style={{ overflowY: 'auto' }} width="100%">
      <Flexbox className={styles.container} gap={16}>
        <Flexbox className={styles.header} gap={6}>
          <Text fontSize={28} weight={700}>
            {t('agentPresets.admin.title')}
          </Text>
          <Text type="secondary">{t('agentPresets.admin.description')}</Text>
        </Flexbox>

        <Block className={styles.hint} variant="filled">
          {t('agentPresets.admin.hint')}
        </Block>

        <Flexbox
          horizontal
          align="center"
          className={styles.toolbar}
          gap={12}
          justify="space-between"
        >
          <SearchBar
            allowClear
            placeholder={t('agentPresets.admin.searchPlaceholder')}
            style={{ maxWidth: 360 }}
            onInputChange={setKeyword}
            onSearch={setKeyword}
          />
          <Button icon={Plus} type="primary" onClick={openCreate}>
            {t('agentPresets.admin.create')}
          </Button>
        </Flexbox>

        {isLoading ? (
          <Skeleton.Button active block style={{ height: 360 }} />
        ) : (data ?? []).length === 0 ? (
          <Empty
            description={t('agentPresets.admin.emptyDescription')}
            title={t('agentPresets.admin.emptyTitle')}
          />
        ) : (
          <Table
            dataSource={filtered}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            rowKey="id"
            size="middle"
            columns={[
              {
                dataIndex: 'title',
                key: 'title',
                render: (_v, row: any) => (
                  <Flexbox gap={2}>
                    <Text weight={600}>{row.title}</Text>
                    <Text fontSize={12} type="secondary">
                      {row.identifier}
                    </Text>
                  </Flexbox>
                ),
                title: t('agentPresets.admin.col.title'),
              },
              {
                dataIndex: 'category',
                key: 'category',
                render: (v) => (v ? <Tag>{v}</Tag> : '—'),
                title: t('agentPresets.admin.col.category'),
              },
              {
                dataIndex: 'tags',
                key: 'tags',
                render: (tags: string[]) =>
                  (tags ?? []).slice(0, 3).map((tag) => (
                    <Tag key={tag} size="small">
                      {tag}
                    </Tag>
                  )),
                title: t('agentPresets.admin.col.tags'),
              },
              {
                dataIndex: 'featured',
                key: 'featured',
                render: (v) => (v ? <Tag color="gold">★</Tag> : '—'),
                title: t('agentPresets.admin.col.featured'),
                width: 80,
              },
              {
                dataIndex: 'status',
                key: 'status',
                render: (status: 'draft' | 'published' | 'archived', row: any) => (
                  <Select
                    size="small"
                    style={{ minWidth: 130 }}
                    value={status}
                    options={[
                      { label: t('agentPresets.admin.status.draft'), value: 'draft' },
                      { label: t('agentPresets.admin.status.published'), value: 'published' },
                      { label: t('agentPresets.admin.status.archived'), value: 'archived' },
                    ]}
                    onChange={(v) => onChangeStatus(row.id, v)}
                  />
                ),
                title: t('agentPresets.admin.col.status'),
                width: 160,
              },
              {
                key: 'actions',
                render: (_v, row: any) => (
                  <Flexbox horizontal gap={4}>
                    <Button icon={Pencil} size="small" onClick={() => openEdit(row.id)} />
                    <Button
                      danger
                      icon={Trash2}
                      size="small"
                      onClick={() => onDelete(row.id, row.title)}
                    />
                  </Flexbox>
                ),
                title: t('agentPresets.admin.col.actions'),
                width: 110,
              },
            ]}
          />
        )}
      </Flexbox>

      <Modal
        destroyOnHidden
        confirmLoading={saving}
        okText={t('agentPresets.admin.save')}
        open={open}
        width={720}
        title={editingId ? t('agentPresets.admin.editTitle') : t('agentPresets.admin.createTitle')}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Flexbox horizontal gap={0}>
            <Form.Item
              label={t('agentPresets.admin.field.title')}
              name="title"
              rules={[{ required: true }]}
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <Input placeholder="Например: Финансовый аналитик" />
            </Form.Item>
            <Form.Item
              label={t('agentPresets.admin.field.identifier')}
              name="identifier"
              style={{ flex: 1 }}
              rules={[
                { required: true },
                {
                  message: t('agentPresets.admin.field.identifierHint'),
                  pattern: /^[\w-]+$/,
                },
              ]}
            >
              <Input placeholder="finance-analyst" />
            </Form.Item>
          </Flexbox>

          <Form.Item label={t('agentPresets.admin.field.description')} name="description">
            <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} maxLength={1000} />
          </Form.Item>

          <Flexbox horizontal gap={0}>
            <Form.Item
              label={t('agentPresets.admin.field.avatar')}
              name="avatar"
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <Input placeholder="📊 или URL" />
            </Form.Item>
            <Form.Item
              label={t('agentPresets.admin.field.backgroundColor')}
              name="backgroundColor"
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <Input placeholder="#EAF3FF" />
            </Form.Item>
            <Form.Item
              label={t('agentPresets.admin.field.category')}
              name="category"
              style={{ flex: 1 }}
            >
              <Input placeholder="finance / operations / support" />
            </Form.Item>
          </Flexbox>

          <Form.Item label={t('agentPresets.admin.field.systemRole')} name="systemRole">
            <Input.TextArea autoSize={{ maxRows: 12, minRows: 4 }} />
          </Form.Item>

          <Flexbox horizontal gap={0}>
            <Form.Item
              label={t('agentPresets.admin.field.provider')}
              name="provider"
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <Input placeholder="openai / anthropic / ..." />
            </Form.Item>
            <Form.Item label={t('agentPresets.admin.field.model')} name="model" style={{ flex: 1 }}>
              <Input placeholder="gpt-4o / claude-3.5-sonnet" />
            </Form.Item>
          </Flexbox>

          <Form.Item label={t('agentPresets.admin.field.openingMessage')} name="openingMessage">
            <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} />
          </Form.Item>

          <Form.Item
            extra={t('agentPresets.admin.field.openingQuestionsHint')}
            label={t('agentPresets.admin.field.openingQuestions')}
            name="openingQuestionsRaw"
          >
            <Input.TextArea autoSize={{ maxRows: 8, minRows: 3 }} />
          </Form.Item>

          <Form.Item
            extra={t('agentPresets.admin.field.tagsHint')}
            label={t('agentPresets.admin.field.tags')}
            name="tagsRaw"
          >
            <Input placeholder="finance, pdf, review" />
          </Form.Item>

          <Flexbox horizontal gap={0}>
            <Form.Item
              label={t('agentPresets.admin.field.status')}
              name="status"
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <Select
                options={[
                  { label: t('agentPresets.admin.status.draft'), value: 'draft' },
                  { label: t('agentPresets.admin.status.published'), value: 'published' },
                  { label: t('agentPresets.admin.status.archived'), value: 'archived' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label={t('agentPresets.admin.field.featured')}
              name="featured"
              style={{ flex: 1 }}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Flexbox>
        </Form>
      </Modal>
    </Flexbox>
  );
});

AgentPresetsAdmin.displayName = 'AgentPresetsAdmin';

export default AgentPresetsAdmin;
