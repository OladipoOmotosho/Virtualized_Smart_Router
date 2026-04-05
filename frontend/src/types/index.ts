// ── Devices ──────────────────────────────────────────────────────────────────

export interface Device {
  id: number;
  mac: string;
  ip: string;
  name: string | null;
  model: string | null;
  version: string | null;
  description: string | null;
  vendor: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceUpdate {
  name?: string;
  model?: string;
  version?: string;
  description?: string;
}

// ── Packet Capture ───────────────────────────────────────────────────────────

export interface CaptureStartRequest {
  device_ids: number[];
  duration?: number;
  packet_count?: number;
}

export interface CaptureSession {
  id: number;
  device_id: number;
  pcap_file: string;
  started_at: string;
  stopped_at: string | null;
}

export interface PcapFile {
  filename: string;
  size_bytes: number;
  created_at: string;
}

// ── Firewall ─────────────────────────────────────────────────────────────────

export type Protocol = "tcp" | "udp" | "icmp";

export interface FirewallRule {
  id: number;
  device_id: number;
  dest_ip: string;
  dest_port: number | null;
  protocol: Protocol;
  created_at: string;
}

export interface FirewallRuleCreate {
  device_id: number;
  dest_ip: string;
  dest_port?: number;
  protocol: Protocol;
}

// ── IPS ──────────────────────────────────────────────────────────────────────

export interface IpsAlert {
  id: number;
  device_id: number;
  measured_rate: number;
  threshold: number;
  triggered_at: string;
}

export interface IpsStatus {
  poll_interval_seconds: number;
  block_duration_seconds: number;
  monitored_devices: number;
  thresholds: Record<number, number>;
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export interface TrafficDataPoint {
  recorded_at: string;
  rate_kbps: number;
}

export interface TrafficHistory {
  device_id: number;
  data: TrafficDataPoint[];
}

// ── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
