import { AlertTriangle, ArrowRight, Check, Inbox, Plus, Settings } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  LanguageSwitcher,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tabs,
  Tr,
  Wordmark,
  useDialog,
  useToast,
} from '@/shared/ui'

// Developer playground: hardcoded English strings are allowed on this page only.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  )
}

const readings = [
  { id: 'SNS 01', metric: 'pH', value: '7.24', status: 'ok' },
  { id: 'SNS 02', metric: 'Water temperature', value: '24.5', status: 'warning' },
  { id: 'SNS 03', metric: 'Ammonia', value: '0.42', status: 'critical' },
  { id: 'SNS 04', metric: 'Dissolved oxygen', value: '8.10', status: 'neutral' },
] as const

export default function UiKitPage() {
  const [tab, setTab] = useState('overview')
  const [pumpOn, setPumpOn] = useState(true)
  const [alertsOn, setAlertsOn] = useState(false)
  const dialog = useDialog()
  const { toast } = useToast()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-12 px-6 py-12">
      <PageHeader
        title="UI kit"
        description="Every AquaTwin component in every variant and state"
        actions={<Wordmark size="sm" />}
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Primary sm</Button>
          <Button variant="secondary" size="sm">
            Secondary sm
          </Button>
          <Button variant="ghost" size="sm">
            Ghost sm
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button leftIcon={Plus}>Add sensor</Button>
          <Button variant="secondary" rightIcon={ArrowRight}>
            Continue
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="ghost" disabled>
            Disabled
          </Button>
        </div>
        <Button variant="secondary" fullWidth>
          Full width
        </Button>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-md gap-6">
          <FormField label="Farm name" htmlFor="farm-name">
            <Input id="farm-name" placeholder="North greenhouse" />
          </FormField>
          <FormField label="Email" htmlFor="email" error="Enter a valid email address">
            <Input id="email" type="email" defaultValue="not an email" invalid />
          </FormField>
          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" placeholder="Anything worth remembering" />
          </FormField>
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-md">
          <CardHeader
            title="Tank A overview"
            description="Realtime readings from the main tank"
            actions={
              <Button variant="ghost" size="sm" leftIcon={Settings}>
                Manage
              </Button>
            }
          />
          <CardContent>
            <p className="text-sm text-muted">
              All parameters are within the normal range. Last sync a minute ago.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Save</Button>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Offline</Badge>
          <Badge variant="ok" icon={Check}>
            Normal
          </Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="critical" icon={AlertTriangle}>
            Critical
          </Badge>
        </div>
      </Section>

      <Section title="Stats">
        <div className="flex flex-wrap gap-12">
          <Stat label="pH" value="7.24" delta={{ value: '+0.12', direction: 'up' }} />
          <Stat
            label="Water temperature"
            value="24.5"
            unit="C"
            delta={{ value: '0.8', direction: 'down' }}
          />
          <Stat
            label="Ammonia"
            value="0.42"
            unit="mg/L"
            delta={{ value: '0.00', direction: 'flat' }}
          />
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <THead>
            <Tr>
              <Th>Sensor</Th>
              <Th>Metric</Th>
              <Th className="text-right">Value</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {readings.map((row) => (
              <Tr key={row.id}>
                <Td className="font-mono tabular-nums">{row.id}</Td>
                <Td>{row.metric}</Td>
                <Td numeric>{row.value}</Td>
                <Td>
                  <Badge variant={row.status}>{row.status}</Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="Tabs">
        <Tabs
          aria-label="Playground sections"
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'sensors', label: 'Sensors' },
            { value: 'alerts', label: 'Alerts' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <p className="text-sm text-muted">Active tab: {tab}</p>
      </Section>

      <Section title="Select">
        <div className="max-w-xs">
          <FormField label="Tank" htmlFor="tank">
            <Select id="tank" defaultValue="a">
              <option value="a">Tank A</option>
              <option value="b">Tank B</option>
              <option value="c">Tank C</option>
            </Select>
          </FormField>
        </div>
      </Section>

      <Section title="Switch">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <Switch checked={pumpOn} onCheckedChange={setPumpOn} aria-label="Pump" />
            <span className="text-sm text-foreground">Pump {pumpOn ? 'on' : 'off'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={alertsOn} onCheckedChange={setAlertsOn} aria-label="Alerts" />
            <span className="text-sm text-foreground">Alerts {alertsOn ? 'on' : 'off'}</span>
          </div>
        </div>
      </Section>

      <Section title="Dialog">
        <div>
          <Button variant="secondary" onClick={dialog.open}>
            Open dialog
          </Button>
        </div>
        <Dialog ref={dialog.ref}>
          <DialogTitle>Remove sensor</DialogTitle>
          <DialogDescription>
            The sensor SNS 03 will stop reporting data. Its history stays available.
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={dialog.close}>
              Cancel
            </Button>
            <Button onClick={dialog.close}>Confirm</Button>
          </DialogFooter>
        </Dialog>
      </Section>

      <Section title="Toast">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => toast('Settings saved')}>
            Show toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast('Ammonia level is critical', { kind: 'critical' })}
          >
            Show critical toast
          </Button>
        </div>
      </Section>

      <Section title="Page header">
        <PageHeader
          title="Sensors"
          description="All sensors across your farm"
          actions={
            <Button size="sm" leftIcon={Plus}>
              Add sensor
            </Button>
          }
        />
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={Inbox}
          title="No sensors yet"
          description="Connect your first sensor to begin monitoring"
          action={
            <Button variant="secondary" size="sm">
              Add sensor
            </Button>
          }
        />
      </Section>

      <Section title="Skeleton">
        <div className="flex max-w-md flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>

      <Section title="Wordmark">
        <div className="flex items-center gap-8">
          <Wordmark size="sm" />
          <Wordmark size="md" />
        </div>
      </Section>

      <Section title="Language switcher">
        <LanguageSwitcher />
      </Section>
    </main>
  )
}
