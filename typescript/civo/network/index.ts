import * as civo from '@pulumi/civo'

const network = new civo.Network('jf-network', {label: 'jf-network'})
const firewall = new civo.Firewall('jf-firewall', {name: 'jf-firewall', networkId: network.id})
const CIDRs = ['0.0.0.0/0']
const httpRule = new civo.FirewallRule('http', {
    firewallId: firewall.id, label: 'http rule',
    cidrs: CIDRs, startPort: '80', endPort: '80', protocol: 'tcp'
  }
)
const httpsRule = new civo.FirewallRule('https', {
    firewallId: firewall.id, label: 'https rule',
    cidrs: CIDRs, startPort: '443', endPort: '443', protocol: 'tcp'
  }, { dependsOn: httpRule }
)
export const networkName = network.name
export const firewallName = firewall.name