import { Card, Col, Divider, List, Row, Tag, Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

const StaticInfoPage = ({
  category,
  title,
  intro,
  highlights = [],
  sections = [],
  contactLabel,
  contactValue,
}) => {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #ffffff 0%, #f7fbff 100%)',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Tag color="blue" style={{ marginBottom: 16, padding: '4px 10px', borderRadius: 999 }}>
          {category}
        </Tag>

        <Title level={2} style={{ marginTop: 0, marginBottom: 12 }}>
          {title}
        </Title>

        <Paragraph style={{ fontSize: 16, lineHeight: 1.8, color: '#475467', marginBottom: 0 }}>
          {intro}
        </Paragraph>
      </Card>

      {highlights.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          {highlights.map((item) => (
            <Col xs={24} md={Math.max(6, Math.floor(24 / highlights.length))} key={item.label}>
              <Card bordered={false} style={{ borderRadius: 14, height: '100%' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {item.label}
                </Text>
                <Title level={4} style={{ margin: 0 }}>
                  {item.value}
                </Title>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {sections.map((section) => (
          <Col xs={24} lg={section.fullWidth ? 24 : 12} key={section.title}>
            <Card bordered={false} style={{ borderRadius: 14, height: '100%' }}>
              <Title level={4} style={{ marginTop: 0 }}>
                {section.title}
              </Title>
              <Paragraph style={{ color: '#475467', lineHeight: 1.8 }}>
                {section.description}
              </Paragraph>

              {section.items?.length > 0 && (
                <List
                  dataSource={section.items}
                  split={false}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '4px 0', border: 'none' }}>
                      <Text>• {item}</Text>
                    </List.Item>
                  )}
                />
              )}

              {section.note && (
                <>
                  <Divider style={{ margin: '16px 0' }} />
                  <Paragraph style={{ marginBottom: 0, color: '#344054' }}>
                    {section.note}
                  </Paragraph>
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {(contactLabel || contactValue) && (
        <Card bordered={false} style={{ marginTop: 24, borderRadius: 14, background: '#0f172a' }}>
          <Text style={{ color: '#cbd5e1' }}>{contactLabel}</Text>
          <Title level={4} style={{ marginTop: 8, marginBottom: 0, color: '#fff' }}>
            {contactValue}
          </Title>
        </Card>
      )}
    </div>
  );
};

export default StaticInfoPage;