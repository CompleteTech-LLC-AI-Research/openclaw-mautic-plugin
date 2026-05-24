<?php
declare(strict_types=1);

use Symfony\Component\Process\Process;

require '/var/www/html/vendor/autoload.php';

header('Content-Type: application/json');

$expectedToken = getenv('MAUTIC_CONSOLE_TOKEN') ?: '';
$providedToken = $_SERVER['HTTP_X_MAUTIC_CONSOLE_TOKEN'] ?? '';

if ($expectedToken === '' || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$commands = [
    'cache:clear' => ['php', 'bin/console', 'cache:clear', '--no-interaction'],
    'mautic:cache:clear' => ['php', 'bin/console', 'mautic:cache:clear', '--no-interaction'],
    'migrations:status' => ['php', 'bin/console', 'doctrine:migrations:status', '--no-interaction'],
    'webhooks:process' => ['php', 'bin/console', 'mautic:webhooks:process', '--no-interaction'],
    'campaigns:rebuild' => ['php', 'bin/console', 'mautic:campaigns:rebuild', '--no-interaction'],
    'campaigns:trigger' => ['php', 'bin/console', 'mautic:campaigns:trigger', '--no-interaction'],
    'segments:update' => ['php', 'bin/console', 'mautic:segments:update', '--no-interaction'],
    'plugins:reload' => ['php', 'bin/console', 'mautic:plugins:reload', '--no-interaction'],
];

$command = (string) ($input['command'] ?? '');
if (!isset($commands[$command])) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => 'command_not_allowed',
        'allowed' => array_keys($commands),
    ]);
    exit;
}

$timeout = (int) ($input['timeoutSeconds'] ?? 300);
$timeout = max(5, min(600, $timeout));

$process = new Process($commands[$command], '/var/www/html', null, null, $timeout);
$process->run();

http_response_code($process->isSuccessful() ? 200 : 500);
echo json_encode([
    'ok' => $process->isSuccessful(),
    'command' => $command,
    'exitCode' => $process->getExitCode(),
    'stdout' => $process->getOutput(),
    'stderr' => $process->getErrorOutput(),
], JSON_UNESCAPED_SLASHES);
