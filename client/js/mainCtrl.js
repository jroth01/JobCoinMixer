/* Main controller */
app.controller('mainCtrl', ['$scope','$route', '$routeParams','$http',
                '$location',
        function($scope, $route, $routeParams, $http, $location) {

            $scope.derp = 'me';
         $scope.master = {foo};

      $scope.update = function(user) {
        $scope.master = angular.copy(user);
      };

      $scope.reset = function() {
        $scope.user = angular.copy($scope.master);
      };

      $scope.reset();

        /* Get exchange rate data */
        $scope.getExchangeRates = function() {
                $http({
                  method: 'GET',
                  url: '/getTicker.json'
                }).then(function successCallback(response) {
                        console.log(response.data);
                        $scope.toArray(response.data);
                }, function errorCallback(error) {
                        console.log(error);
                });
        };

        /* Get exchange rates when the controller loads */
        $scope.getExchangeRates();
}]);
