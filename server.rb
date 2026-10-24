# AVIS Six static viewer. Engineering references remain private to the repository.
require 'webrick'
root = File.expand_path('web', __dir__)
port = Integer(ENV.fetch('PORT', '4173'))
host = ENV.fetch('HOST', '0.0.0.0')
mime = WEBrick::HTTPUtils::DefaultMimeTypes.merge(
  'js' => 'application/javascript', 'mjs' => 'application/javascript',
  'svg' => 'image/svg+xml', 'json' => 'application/json'
)
server = WEBrick::HTTPServer.new(
  Port: port, BindAddress: host, AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN),
  MimeTypes: mime, ServerSoftware: 'AVIS-Six'
)
server.mount_proc('/') do |request, response|
  response['Cache-Control'] = 'no-store'
  response['X-Content-Type-Options'] = 'nosniff'
  unless ['GET', 'HEAD'].include?(request.request_method)
    response.status = 405
    response['Allow'] = 'GET, HEAD'
    next
  end
  relative = request.path.delete_prefix('/')
  relative = 'index.html' if relative.empty?
  target = File.expand_path(relative, root)
  if relative.split('/').any? { |part| part.start_with?('.') } ||
     !target.start_with?(root + File::SEPARATOR) ||
     !File.file?(target) ||
     !File.realpath(target).start_with?(File.realpath(root) + File::SEPARATOR)
    response.status = 404
    response.body = 'Not found'
    next
  end
  response['Content-Type'] = mime.fetch(File.extname(target).delete_prefix('.'), 'application/octet-stream')
  response.body = File.binread(target)
end
['INT', 'TERM'].each { |signal| trap(signal) { server.shutdown } }
puts "AVIS Six available at http://#{host}:#{port}"
$stdout.flush
server.start
