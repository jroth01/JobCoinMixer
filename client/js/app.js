/* Define angular module */
var app = angular.module('myApp', ['ngRoute','ui.router']);

/* Routing logic */
app.config(function($routeProvider,$locationProvider) {

  $routeProvider
        .when('/', {
                templateUrl: 'partials/dashboard.html',
                controller: 'mainCtrl'
        });
});
