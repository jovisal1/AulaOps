import json
import subprocess
import types
import unittest
from unittest.mock import patch
from test_app import aula


def device(name, address, prefix=24, flags=None, state='UP'):
    return {'ifname': name, 'operstate': state, 'flags': flags or ['UP', 'LOWER_UP'],
            'addr_info': [{'family': 'inet', 'scope': 'global', 'local': address, 'prefixlen': prefix}]}


class LocalNetworkTests(unittest.TestCase):
    def detect(self, addresses, routes):
        values = [types.SimpleNamespace(stdout=json.dumps(addresses)), types.SimpleNamespace(stdout=json.dumps(routes))]
        with patch.object(aula.subprocess, 'run', side_effect=values) as run:
            result = aula.local_networks()
        self.assertTrue(all(call.kwargs['timeout'] == 5 for call in run.call_args_list))
        return result

    def test_real_mask_and_default_route_priority(self):
        networks = self.detect([device('wlan0', '192.168.4.55'), device('eth0', '10.20.7.10', 22)],
                               [{'dev': 'wlan0', 'metric': 600}, {'dev': 'eth0', 'metric': 100}])
        self.assertEqual(networks[0]['interface'], 'eth0')
        self.assertEqual(networks[0]['cidr'], '10.20.4.0/22')
        self.assertEqual(networks[1]['cidr'], '192.168.4.0/24')

    def test_filters_inactive_virtual_loopback_and_public_networks(self):
        addresses = [device('lo', '127.0.0.1', flags=['LOOPBACK']), device('docker0', '172.17.0.1'),
                     device('veth0', '172.18.0.1'), device('tun0', '10.8.0.1'),
                     device('eth1', '192.168.2.1', state='DOWN'), device('eth2', '8.8.8.8'),
                     device('wlan0', '192.168.3.5')]
        self.assertEqual([n['interface'] for n in self.detect(addresses, [])], ['wlan0'])

    def test_disconnected_and_missing_ip_are_actionable_errors(self):
        with self.assertRaisesRegex(ValueError, 'Conecta'):
            self.detect([], [])
        for error in [FileNotFoundError(), subprocess.TimeoutExpired('ip', 5)]:
            with patch.object(aula.subprocess, 'run', side_effect=error), self.assertRaisesRegex(ValueError, 'iproute2'):
                aula.local_networks()

    def test_discovery_rechecks_connection_and_excludes_this_computer(self):
        networks = [{'id': 'eth0:192.168.1.5/24', 'interface': 'eth0', 'address': '192.168.1.5', 'cidr': '192.168.1.0/24'}]
        with patch.object(aula, 'local_networks', return_value=networks), patch.object(aula, 'discover', return_value=['192.168.1.10']) as discover:
            result = aula.discover_local(None, 2222)
            discover.assert_called_once_with('192.168.1.0/24', 2222, max_addresses=65536, exclude={'192.168.1.5'})
            self.assertEqual(result['network'], networks[0])
            self.assertEqual(result['hosts'], ['192.168.1.10'])
            with self.assertRaisesRegex(ValueError, 'ha cambiado'):
                aula.discover_local('old-network', 22)

    def test_scan_excludes_local_address_and_checks_ssh_banner(self):
        connection = unittest.mock.MagicMock()
        connection.__enter__.return_value.recv.return_value = b'SSH-2.0-test'
        with patch.object(aula.socket, 'create_connection', return_value=connection) as connect:
            self.assertEqual(aula.discover('192.168.1.0/30', 2222, exclude={'192.168.1.1'}), ['192.168.1.2'])
            connect.assert_called_once_with(('192.168.1.2', 2222), timeout=0.7)

    def test_automatic_scan_remains_bounded(self):
        with patch.object(aula.socket, 'create_connection') as connect:
            with self.assertRaises(ValueError):
                aula.discover('10.0.0.0/8', 22, max_addresses=65536)
            connect.assert_not_called()
